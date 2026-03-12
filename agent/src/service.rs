#[cfg(windows)]
pub mod windows_service {
    use crate::api_client::ApiClient;
    use crate::config::Config;
    use crate::poller::run_poll_loop;
    use std::ffi::OsString;
    use std::time::Duration;
    use tokio::sync::watch;
    use tracing::info;
    use windows_service::service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    };
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
    use windows_service::{define_windows_service, service_dispatcher};

    const SERVICE_NAME: &str = "CrustyAgent";
    const SERVICE_TYPE: ServiceType = ServiceType::OWN_PROCESS;

    define_windows_service!(ffi_service_main, service_main_wrapper);

    pub fn run() -> Result<(), Box<dyn std::error::Error>> {
        service_dispatcher::start(SERVICE_NAME, ffi_service_main)?;
        Ok(())
    }

    fn service_main_wrapper(arguments: Vec<OsString>) {
        if let Err(e) = service_main(arguments) {
            tracing::error!("Service failed: {}", e);
        }
    }

    fn service_main(_arguments: Vec<OsString>) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = std::env::current_exe()?
            .parent()
            .ok_or("No parent dir")?
            .join("config.toml");

        let config = Config::load(&config_path)?;
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        let event_handler = move |control_event| -> ServiceControlHandlerResult {
            match control_event {
                ServiceControl::Stop => {
                    info!("Service stop requested");
                    let _ = shutdown_tx.send(true);
                    ServiceControlHandlerResult::NoError
                }
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };

        let status_handle =
            service_control_handler::register(SERVICE_NAME, event_handler)?;

        status_handle.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::Running,
            controls_accepted: ServiceControlAccept::STOP,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        })?;

        let rt = tokio::runtime::Runtime::new()?;
        rt.block_on(async {
            let client = ApiClient::new(&config).expect("Failed to create API client");
            let poll_interval = Duration::from_secs(config.server.poll_interval_secs);
            run_poll_loop(client, poll_interval, shutdown_rx).await;
        });

        status_handle.set_service_status(ServiceStatus {
            service_type: SERVICE_TYPE,
            current_state: ServiceState::Stopped,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        })?;

        Ok(())
    }

    pub fn install() -> Result<(), Box<dyn std::error::Error>> {
        use std::ffi::OsStr;
        use windows_service::service::{ServiceAccess, ServiceErrorControl, ServiceInfo, ServiceStartType};
        use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};

        let manager =
            ServiceManager::local_computer(None::<&OsStr>, ServiceManagerAccess::CREATE_SERVICE)?;

        let exe_path = std::env::current_exe()?;

        let service_info = ServiceInfo {
            name: OsString::from(SERVICE_NAME),
            display_name: OsString::from("CrustyHelpdesk Log Agent"),
            service_type: SERVICE_TYPE,
            start_type: ServiceStartType::AutoStart,
            error_control: ServiceErrorControl::Normal,
            executable_path: exe_path,
            launch_arguments: vec![],
            dependencies: vec![],
            account_name: None,
            account_password: None,
        };

        let _service = manager.create_service(&service_info, ServiceAccess::CHANGE_CONFIG)?;
        println!("Service '{}' installed successfully.", SERVICE_NAME);
        Ok(())
    }

    pub fn uninstall() -> Result<(), Box<dyn std::error::Error>> {
        use std::ffi::OsStr;
        use windows_service::service::ServiceAccess;
        use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};

        let manager =
            ServiceManager::local_computer(None::<&OsStr>, ServiceManagerAccess::CONNECT)?;

        let service = manager.open_service(SERVICE_NAME, ServiceAccess::DELETE)?;
        service.delete()?;
        println!("Service '{}' uninstalled successfully.", SERVICE_NAME);
        Ok(())
    }
}

mod api_client;
mod config;
mod event_log;
mod models;
mod poller;
mod service;

use config::Config;
use std::path::PathBuf;
use std::time::Duration;
use tracing::info;
use tracing_subscriber::EnvFilter;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(|s| s.as_str()).unwrap_or("");

    match command {
        "install" => {
            #[cfg(windows)]
            service::windows_service::install()?;
            #[cfg(not(windows))]
            eprintln!("Service install is only supported on Windows.");
        }
        "uninstall" => {
            #[cfg(windows)]
            service::windows_service::uninstall()?;
            #[cfg(not(windows))]
            eprintln!("Service uninstall is only supported on Windows.");
        }
        "run" => {
            // Console mode — run poll loop directly
            let config_path = find_config()?;
            let config = Config::load(&config_path)?;
            info!(
                "Starting in console mode for machine: {}",
                config.machine_name()
            );

            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(async {
                let client =
                    api_client::ApiClient::new(&config).expect("Failed to create API client");
                let poll_interval = Duration::from_secs(config.server.poll_interval_secs);
                let (_shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

                // Handle Ctrl+C
                let shutdown_tx_clone = _shutdown_tx.clone();
                tokio::spawn(async move {
                    tokio::signal::ctrl_c()
                        .await
                        .expect("Failed to listen for Ctrl+C");
                    info!("Ctrl+C received, shutting down...");
                    let _ = shutdown_tx_clone.send(true);
                });

                poller::run_poll_loop(client, poll_interval, shutdown_rx).await;
            });
        }
        "" => {
            // No argument — try to start as Windows service
            #[cfg(windows)]
            {
                info!("Starting as Windows service...");
                service::windows_service::run()?;
            }
            #[cfg(not(windows))]
            {
                eprintln!("Usage: crusty-agent <install|uninstall|run>");
                eprintln!("  install    Install as Windows service");
                eprintln!("  uninstall  Remove Windows service");
                eprintln!("  run        Run in console mode (for development)");
                std::process::exit(1);
            }
        }
        _ => {
            eprintln!("Unknown command: {}", command);
            eprintln!("Usage: crusty-agent <install|uninstall|run>");
            std::process::exit(1);
        }
    }

    Ok(())
}

fn find_config() -> Result<PathBuf, Box<dyn std::error::Error>> {
    // Check next to executable first, then current directory
    let exe_dir = std::env::current_exe()?
        .parent()
        .ok_or("No parent dir")?
        .join("config.toml");

    if exe_dir.exists() {
        return Ok(exe_dir);
    }

    let cwd = PathBuf::from("config.toml");
    if cwd.exists() {
        return Ok(cwd);
    }

    Err("config.toml not found. Place it next to the executable or in the current directory.".into())
}

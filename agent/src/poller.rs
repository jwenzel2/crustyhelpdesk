use crate::api_client::ApiClient;
use crate::event_log::read_event_log;
use crate::models::{TaskResult, TaskStatus};
use std::time::Duration;
use tokio::sync::watch;
use tracing::{error, info};

pub async fn run_poll_loop(
    client: ApiClient,
    poll_interval: Duration,
    mut shutdown: watch::Receiver<bool>,
) {
    info!("Poll loop started, interval: {:?}", poll_interval);

    loop {
        // Check for shutdown
        if *shutdown.borrow() {
            info!("Shutdown signal received, stopping poll loop");
            break;
        }

        match client.get_tasks().await {
            Ok(tasks) => {
                if !tasks.is_empty() {
                    info!("Received {} task(s)", tasks.len());
                }
                for task in tasks {
                    info!(
                        "Processing task {} — {} log for {}",
                        task.id, task.log_type, task.machine_name
                    );

                    let result = match read_event_log(
                        &task.log_type,
                        task.time_range_start,
                        task.time_range_end,
                    ) {
                        Ok(entries) => {
                            info!(
                                "Collected {} entries for task {}",
                                entries.len(),
                                task.id
                            );
                            TaskResult {
                                status: TaskStatus::Completed,
                                error_message: None,
                                entries,
                            }
                        }
                        Err(e) => {
                            error!("Failed to read event log for task {}: {}", task.id, e);
                            TaskResult {
                                status: TaskStatus::Failed,
                                error_message: Some(e),
                                entries: vec![],
                            }
                        }
                    };

                    if let Err(e) = client.submit_results(&task.id, &result).await {
                        error!("Failed to submit results for task {}: {}", task.id, e);
                    } else {
                        info!("Submitted results for task {}", task.id);
                    }
                }
            }
            Err(e) => {
                error!("Failed to fetch tasks: {}", e);
            }
        }

        // Sleep with shutdown check
        tokio::select! {
            _ = tokio::time::sleep(poll_interval) => {},
            _ = shutdown.changed() => {
                if *shutdown.borrow() {
                    info!("Shutdown signal received during sleep");
                    break;
                }
            }
        }
    }

    info!("Poll loop stopped");
}

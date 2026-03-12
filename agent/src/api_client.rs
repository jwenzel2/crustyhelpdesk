use crate::config::Config;
use crate::models::{Task, TaskResult};
use reqwest::Client;
use std::time::Duration;
use tracing::{error, warn};

pub struct ApiClient {
    client: Client,
    base_url: String,
    api_key: String,
    machine_name: String,
}

impl ApiClient {
    pub fn new(config: &Config) -> Result<Self, reqwest::Error> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(Self {
            client,
            base_url: config.server.url.trim_end_matches('/').to_string(),
            api_key: config.server.api_key.clone(),
            machine_name: config.machine_name(),
        })
    }

    pub async fn get_tasks(&self) -> Result<Vec<Task>, Box<dyn std::error::Error>> {
        let url = format!(
            "{}/api/agent/tasks?machine={}",
            self.base_url, self.machine_name
        );

        let response = self.with_retry(|| {
            self.client
                .get(&url)
                .bearer_auth(&self.api_key)
                .timeout(Duration::from_secs(30))
                .send()
        })
        .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("GET tasks failed: {} - {}", status, body).into());
        }

        let tasks: Vec<Task> = response.json().await?;
        Ok(tasks)
    }

    pub async fn submit_results(
        &self,
        task_id: &str,
        results: &TaskResult,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let url = format!(
            "{}/api/agent/tasks/{}/results",
            self.base_url, task_id
        );

        let response = self.with_retry(|| {
            self.client
                .post(&url)
                .bearer_auth(&self.api_key)
                .json(results)
                .timeout(Duration::from_secs(120))
                .send()
        })
        .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("POST results failed: {} - {}", status, body).into());
        }

        Ok(())
    }

    async fn with_retry<F, Fut>(
        &self,
        f: F,
    ) -> Result<reqwest::Response, reqwest::Error>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<reqwest::Response, reqwest::Error>>,
    {
        let mut last_err = None;
        for attempt in 0..3u32 {
            if attempt > 0 {
                let delay = Duration::from_secs(2u64.pow(attempt));
                warn!("Retrying in {:?} (attempt {})", delay, attempt + 1);
                tokio::time::sleep(delay).await;
            }
            match f().await {
                Ok(resp) => return Ok(resp),
                Err(e) => {
                    error!("Request failed (attempt {}): {}", attempt + 1, e);
                    last_err = Some(e);
                }
            }
        }
        Err(last_err.unwrap())
    }
}

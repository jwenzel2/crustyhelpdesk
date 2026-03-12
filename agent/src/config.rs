use serde::Deserialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub agent: AgentConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub url: String,
    pub api_key: String,
    #[serde(default = "default_poll_interval")]
    pub poll_interval_secs: u64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AgentConfig {
    pub machine_name: Option<String>,
}

fn default_poll_interval() -> u64 {
    30
}

impl Config {
    pub fn load(path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn machine_name(&self) -> String {
        self.agent
            .machine_name
            .clone()
            .unwrap_or_else(|| hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "UNKNOWN".to_string()))
    }
}

// Simple hostname fallback without extra crate
mod hostname {
    use std::ffi::OsString;

    pub fn get() -> Result<OsString, std::io::Error> {
        #[cfg(windows)]
        {
            use std::env;
            Ok(OsString::from(
                env::var("COMPUTERNAME").unwrap_or_else(|_| "UNKNOWN".to_string()),
            ))
        }
        #[cfg(not(windows))]
        {
            use std::process::Command;
            let output = Command::new("hostname").output()?;
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(OsString::from(name))
        }
    }
}

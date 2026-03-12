use crate::models::LogEntrySubmission;
use chrono::{DateTime, Utc};
use tracing::{debug, error, info};

/// Allowed log types — both the agent and webapp validate against this list.
const ALLOWED_LOG_TYPES: &[&str] = &["Application", "System", "Security", "Setup"];

/// Reads Windows Event Log entries for the given log type and time range.
///
/// Uses the Windows Event Log API (EvtQuery) — no shell execution,
/// no Command::new(), no std::process.
pub fn read_event_log(
    log_type: &str,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> Result<Vec<LogEntrySubmission>, String> {
    // Validate log type against hardcoded allowlist
    if !ALLOWED_LOG_TYPES.contains(&log_type) {
        return Err(format!("Invalid log type: {}", log_type));
    }

    info!(
        "Reading {} log from {} to {}",
        log_type,
        start.to_rfc3339(),
        end.to_rfc3339()
    );

    #[cfg(windows)]
    {
        read_event_log_windows(log_type, start, end)
    }

    #[cfg(not(windows))]
    {
        debug!("Not on Windows — returning empty log entries for {}", log_type);
        let _ = (start, end);
        Ok(vec![])
    }
}

#[cfg(windows)]
fn read_event_log_windows(
    log_type: &str,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
) -> Result<Vec<LogEntrySubmission>, String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::EventLog::*;
    use windows::Win32::Foundation::ERROR_NO_MORE_ITEMS;

    let start_str = start.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    let end_str = end.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

    // XPath query to filter by time range
    let query = format!(
        "*[System[TimeCreated[@SystemTime>='{}' and @SystemTime<='{}']]]",
        start_str, end_str
    );

    let channel: Vec<u16> = log_type.encode_utf16().chain(std::iter::once(0)).collect();
    let query_w: Vec<u16> = query.encode_utf16().chain(std::iter::once(0)).collect();

    let h_query = unsafe {
        EvtQuery(
            None,
            PCWSTR(channel.as_ptr()),
            PCWSTR(query_w.as_ptr()),
            EvtQueryChannelPath.0 | EvtQueryForwardDirection.0,
        )
    }
    .map_err(|e| format!("EvtQuery failed: {}", e))?;

    let mut entries = Vec::new();
    let mut events: [isize; 100] = [0; 100];
    let max_entries = 10_000usize;

    loop {
        if entries.len() >= max_entries {
            info!("Hit entry cap of {}, stopping collection", max_entries);
            break;
        }

        let mut returned: u32 = 0;
        let batch_size = std::cmp::min(100, max_entries - entries.len()) as u32;

        let ok = unsafe {
            EvtNext(
                h_query,
                &mut events[..batch_size as usize],
                1000, // timeout ms
                0,
                &mut returned,
            )
        };

        if ok.is_err() {
            // Check if we're just done
            let err = unsafe { windows::Win32::Foundation::GetLastError() };
            if err == ERROR_NO_MORE_ITEMS {
                break;
            }
            error!("EvtNext failed: {:?}", err);
            break;
        }

        if returned == 0 {
            break;
        }

        for i in 0..returned as usize {
            let h_event = EVT_HANDLE(events[i]);
            match render_event_xml(h_event) {
                Ok(xml) => {
                    if let Some(entry) = parse_event_xml(&xml) {
                        entries.push(entry);
                    }
                }
                Err(e) => {
                    debug!("Failed to render event: {}", e);
                }
            }
            unsafe {
                let _ = EvtClose(h_event);
            }
        }
    }

    unsafe {
        let _ = EvtClose(h_query);
    }

    info!("Collected {} entries from {} log", entries.len(), log_type);
    Ok(entries)
}

#[cfg(windows)]
fn render_event_xml(h_event: windows::Win32::System::EventLog::EVT_HANDLE) -> Result<String, String> {
    use windows::Win32::System::EventLog::*;

    let mut buffer_size: u32 = 0;
    let mut _prop_count: u32 = 0;

    // First call to get required buffer size
    let _ = unsafe {
        EvtRender(
            None,
            h_event,
            EvtRenderEventXml.0,
            0,
            None,
            &mut buffer_size,
            &mut _prop_count,
        )
    };

    let mut buffer: Vec<u16> = vec![0u16; (buffer_size / 2) as usize + 1];

    unsafe {
        EvtRender(
            None,
            h_event,
            EvtRenderEventXml.0,
            buffer_size,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut buffer_size,
            &mut _prop_count,
        )
    }
    .map_err(|e| format!("EvtRender failed: {}", e))?;

    // Find null terminator
    let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    Ok(String::from_utf16_lossy(&buffer[..len]))
}

#[cfg(windows)]
fn parse_event_xml(xml: &str) -> Option<LogEntrySubmission> {
    // Simple XML parsing — extract key fields without pulling in a full XML crate
    let event_id = extract_xml_value(xml, "EventID")
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0);

    let level_num = extract_xml_value(xml, "Level")
        .and_then(|v| v.parse::<u8>().ok())
        .unwrap_or(4);
    let level = match level_num {
        1 => "Critical",
        2 => "Error",
        3 => "Warning",
        4 => "Information",
        5 => "Verbose",
        _ => "Unknown",
    }
    .to_string();

    let source = extract_xml_attr(xml, "Provider", "Name").unwrap_or_else(|| "Unknown".to_string());

    let timestamp_str = extract_xml_attr(xml, "TimeCreated", "SystemTime")
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    let timestamp = DateTime::parse_from_rfc3339(&timestamp_str)
        .map(|dt| dt.with_timezone(&Utc))
        .or_else(|_| {
            // Windows sometimes uses a slightly different format
            chrono::NaiveDateTime::parse_from_str(&timestamp_str, "%Y-%m-%dT%H:%M:%S%.fZ")
                .map(|ndt| ndt.and_utc())
        })
        .unwrap_or_else(|_| Utc::now());

    // Extract message from EventData or RenderingInfo if available
    let message = extract_event_data(xml).unwrap_or_else(|| format!("Event {}", event_id));

    Some(LogEntrySubmission {
        event_id,
        level,
        source,
        message,
        timestamp,
        raw_xml: Some(xml.to_string()),
    })
}

#[cfg(windows)]
fn extract_xml_value(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)?;
    let after_open = &xml[start..];
    let content_start = after_open.find('>')? + 1;
    let content = &after_open[content_start..];
    let end = content.find(&close)?;
    Some(content[..end].to_string())
}

#[cfg(windows)]
fn extract_xml_attr(xml: &str, tag: &str, attr: &str) -> Option<String> {
    let open = format!("<{}", tag);
    let start = xml.find(&open)?;
    let after_tag = &xml[start..];
    let attr_search = format!("{}='", attr);
    if let Some(attr_start) = after_tag.find(&attr_search) {
        let value_start = attr_start + attr_search.len();
        let value = &after_tag[value_start..];
        let end = value.find('\'')?;
        return Some(value[..end].to_string());
    }
    // Try double quotes
    let attr_search = format!("{}=\"", attr);
    let attr_start = after_tag.find(&attr_search)?;
    let value_start = attr_start + attr_search.len();
    let value = &after_tag[value_start..];
    let end = value.find('"')?;
    Some(value[..end].to_string())
}

#[cfg(windows)]
fn extract_event_data(xml: &str) -> Option<String> {
    // Try to get data from EventData section
    if let Some(start) = xml.find("<EventData>") {
        if let Some(end) = xml.find("</EventData>") {
            let data_section = &xml[start + 11..end];
            let mut parts = Vec::new();
            let mut remaining = data_section;
            while let Some(ds) = remaining.find("<Data") {
                let after = &remaining[ds..];
                if let Some(cs) = after.find('>') {
                    let content = &after[cs + 1..];
                    if let Some(ce) = content.find("</Data>") {
                        let value = &content[..ce];
                        if !value.is_empty() {
                            parts.push(value.to_string());
                        }
                        remaining = &content[ce + 7..];
                        continue;
                    }
                }
                break;
            }
            if !parts.is_empty() {
                return Some(parts.join(" | "));
            }
        }
    }
    None
}

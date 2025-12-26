use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

// Default shortcuts
const DEFAULT_TOGGLE_SHORTCUT: &str = "Ctrl+Shift+O";
const DEFAULT_PASTE_SHORTCUT: &str = "Ctrl+Shift+V";

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ShortcutSettings {
    pub toggle_overlay: String,
    pub paste_asset: String,
}

impl Default for ShortcutSettings {
    fn default() -> Self {
        Self {
            toggle_overlay: DEFAULT_TOGGLE_SHORTCUT.to_string(),
            paste_asset: DEFAULT_PASTE_SHORTCUT.to_string(),
        }
    }
}

struct AppState {
    settings: Mutex<ShortcutSettings>,
}

fn get_settings_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|p| p.join("settings.json"))
}

fn load_settings_from_file(app: &tauri::AppHandle) -> ShortcutSettings {
    if let Some(path) = get_settings_path(app) {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(settings) = serde_json::from_str::<ShortcutSettings>(&content) {
                    return settings;
                }
            }
        }
    }
    ShortcutSettings::default()
}

fn save_settings_to_file(
    app: &tauri::AppHandle,
    settings: &ShortcutSettings,
) -> Result<(), String> {
    let path = get_settings_path(app).ok_or("Failed to get settings path")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState {
            settings: Mutex::new(ShortcutSettings::default()),
        })
        .invoke_handler(tauri::generate_handler![
            open_options_window,
            get_shortcuts,
            update_shortcuts
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Load settings from file
            let settings = load_settings_from_file(app.handle());
            {
                let state = app.state::<AppState>();
                *state.settings.lock().unwrap() = settings.clone();
            }

            setup_tray(app)?;
            let handle = app.handle().clone();
            register_shortcuts(&handle, &settings);
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Clone, Serialize)]
struct PgSetFieldMessage<'a> {
    #[serde(rename = "type")]
    type_: &'static str,
    #[serde(rename = "fieldId")]
    field_id: &'a str,
    value: String,
}

fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(true);
        if visible {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

fn show_overlay(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn navigate_main_to(app: &tauri::AppHandle, target_path: &str) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();

        if let Ok(mut url) = w.url() {
            url.set_path(&format!("/{}", target_path.trim_start_matches('/')));
            url.set_query(None);
            url.set_fragment(None);
            let _ = w.navigate(url);
        }
    }
}

fn inject_clipboard_to_asset(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let text = match app.clipboard().read_text() {
            Ok(t) => t,
            Err(e) => {
                log::warn!("clipboard read failed: {e}");
                return;
            }
        };

        let value = text.trim().to_string();
        if value.is_empty() {
            show_overlay(&app);
            return;
        }

        show_overlay(&app);

        if let Some(w) = app.get_webview_window("main") {
            let payload = PgSetFieldMessage {
                type_: "PG_SET_FIELD",
                field_id: "asset",
                value,
            };
            let _ = w.emit("PG_SET_FIELD", payload);
        }
    });
}

fn unregister_all_shortcuts(app: &tauri::AppHandle) {
    let _ = app.global_shortcut().unregister_all();
}

fn register_shortcuts(app: &tauri::AppHandle, settings: &ShortcutSettings) {
    // Register toggle overlay shortcut
    if let Ok(shortcut) = settings.toggle_overlay.parse::<Shortcut>() {
        let res = app.global_shortcut().on_shortcut(shortcut, |app, _s, e| {
            if e.state() != ShortcutState::Pressed {
                return;
            }
            toggle_overlay(app);
        });
        if let Err(e) = res {
            log::warn!(
                "failed to register shortcut {}: {e}",
                settings.toggle_overlay
            );
        }
    } else {
        log::warn!("invalid shortcut format: {}", settings.toggle_overlay);
    }

    // Register paste asset shortcut
    if let Ok(shortcut) = settings.paste_asset.parse::<Shortcut>() {
        let res = app.global_shortcut().on_shortcut(shortcut, |app, _s, e| {
            if e.state() != ShortcutState::Pressed {
                return;
            }
            inject_clipboard_to_asset(app.clone());
        });
        if let Err(e) = res {
            log::warn!("failed to register shortcut {}: {e}", settings.paste_asset);
        }
    } else {
        log::warn!("invalid shortcut format: {}", settings.paste_asset);
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::TrayIconBuilder;

    let toggle_item =
        MenuItem::with_id(app, "toggle_overlay", "오버레이 토글", true, None::<&str>)?;
    let paste_item = MenuItem::with_id(app, "paste_asset", "클립보드 → ASSET", true, None::<&str>)?;
    let options_item = MenuItem::with_id(app, "open_options", "템플릿 관리", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "단축키 설정", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;

    let menu = Menu::new(app)?;
    menu.append_items(&[
        &toggle_item,
        &paste_item,
        &PredefinedMenuItem::separator(app)?,
        &options_item,
        &settings_item,
        &PredefinedMenuItem::separator(app)?,
        &quit_item,
    ])?;

    let icon = app.default_window_icon().cloned();
    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("프롬프트 생성기");

    if let Some(icon) = icon {
        tray = tray.icon(icon);
    }

    tray.on_menu_event(|app, event| match event.id().as_ref() {
        "toggle_overlay" => toggle_overlay(app),
        "paste_asset" => inject_clipboard_to_asset(app.clone()),
        "open_options" => {
            navigate_main_to(app, "options/options.html");
        }
        "open_settings" => {
            navigate_main_to(app, "settings/settings.html");
        }
        "quit" => app.exit(0),
        _ => {}
    })
    .build(app)?;

    Ok(())
}

#[tauri::command]
async fn open_options_window(app: tauri::AppHandle) -> Result<(), String> {
    navigate_main_to(&app, "options/options.html");
    Ok(())
}

#[tauri::command]
async fn get_shortcuts(app: tauri::AppHandle) -> Result<ShortcutSettings, String> {
    let state = app.state::<AppState>();
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
async fn update_shortcuts(app: tauri::AppHandle, settings: ShortcutSettings) -> Result<(), String> {
    // Validate shortcuts by trying to parse them
    settings
        .toggle_overlay
        .parse::<Shortcut>()
        .map_err(|_| format!("Invalid shortcut format: {}", settings.toggle_overlay))?;
    settings
        .paste_asset
        .parse::<Shortcut>()
        .map_err(|_| format!("Invalid shortcut format: {}", settings.paste_asset))?;

    // Save to file
    save_settings_to_file(&app, &settings)?;

    // Update state
    {
        let state = app.state::<AppState>();
        *state.settings.lock().map_err(|e| e.to_string())? = settings.clone();
    }

    // Re-register shortcuts
    unregister_all_shortcuts(&app);
    register_shortcuts(&app, &settings);

    Ok(())
}

use serde::Serialize;
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![open_options_window])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            setup_tray(app)?;
            let handle = app.handle().clone();
            setup_global_shortcuts(&handle);
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

fn setup_global_shortcuts(app: &tauri::AppHandle) {
    let toggle_res = app
        .global_shortcut()
        .on_shortcut("Ctrl+Shift+O", |app, _s, e| {
            if e.state() != ShortcutState::Pressed {
                return;
            }
            toggle_overlay(app);
        });
    if let Err(e) = toggle_res {
        log::warn!("failed to register shortcut Ctrl+Shift+O: {e}");
    }

    let paste_res = app
        .global_shortcut()
        .on_shortcut("Ctrl+Shift+V", |app, _s, e| {
            if e.state() != ShortcutState::Pressed {
                return;
            }
            inject_clipboard_to_asset(app.clone());
        });
    if let Err(e) = paste_res {
        log::warn!("failed to register shortcut Ctrl+Shift+V: {e}");
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::TrayIconBuilder;

    let toggle_item =
        MenuItem::with_id(app, "toggle_overlay", "오버레이 토글", true, None::<&str>)?;
    let paste_item = MenuItem::with_id(app, "paste_asset", "클립보드 → ASSET", true, None::<&str>)?;
    let options_item = MenuItem::with_id(app, "open_options", "템플릿 관리", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;

    let menu = Menu::new(app)?;
    menu.append_items(&[
        &toggle_item,
        &paste_item,
        &PredefinedMenuItem::separator(app)?,
        &options_item,
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

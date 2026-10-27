// KS_NATIVE_DESKTOP_v1 - no console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    staff_portal_desktop_lib::run();
}

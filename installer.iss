; installer.iss — SyncView Desktop

#define MyAppVersion "1.0.0"

[Setup]
AppName=SyncView
AppVersion={#MyAppVersion}
AppPublisher=Your Name or Team
DefaultDirName={pf}\SyncView
DefaultGroupName=SyncView
OutputDir=Output
OutputBaseFilename=SyncView-Setup
Compression=lzma
SolidCompression=yes
DisableProgramGroupPage=yes
ArchitecturesInstallIn64BitMode=x64
; SetupIconFile=assets\SyncView.ico

[Files]
; 1) App folder build từ PyInstaller (one-folder)
Source: "dist\SyncView\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; 2) WebView2 Evergreen bootstrapper
Source: "assets\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
; Shortcut trong Start Menu
Name: "{group}\SyncView"; Filename: "{app}\SyncView.exe"
; (tuỳ chọn) Shortcut Desktop
; Name: "{commondesktop}\SyncView"; Filename: "{app}\SyncView.exe"; Tasks: desktopicon

[Tasks]
; (tuỳ chọn) checkbox tạo shortcut desktop
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Run]
; Cài WebView2 nếu máy chưa có (bootstrapper sẽ tự detect)
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installing Microsoft WebView2..."; Flags: skipifdoesntexist

[UninstallDelete]
; Xoá session nếu bạn muốn giữ sạch (bỏ nếu muốn giữ phiên người dùng)
Type: filesandordirs; Name: "{userappdata}\.syncview"

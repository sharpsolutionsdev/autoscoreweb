; DartVoice — Windows Installer
; Built with Inno Setup 6  (free download: jrsoftware.org/isinfo.php)
;
; HOW TO BUILD THE INSTALLER:
;   1. Download & install Inno Setup 6 from jrsoftware.org/isinfo.php
;   2. Run:  pyinstaller DartVoice.spec          (builds dist\DartVoice\)
;   3. Open this file in Inno Setup → Build → Compile
;   4. Installer appears at:  installer_output\DartVoice_Setup.exe
;
; The resulting DartVoice_Setup.exe is the file you distribute to users.
; They double-click it, click Next a couple of times, done.
; No Python required on their machine — ever.

#define AppName      "DartVoice"
#define AppVersion   "1.0"
#define AppPublisher "DartVoice"
#define AppURL       "https://dartvoice.com"
#define AppExeName   "DartVoice.exe"
#define SourceDir    "dist\DartVoice"

[Setup]
AppId={{8F3A2D1E-4C7B-4A9F-B2E6-1D5C8F9A3B7E}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=installer_output
OutputBaseFilename=DartVoice_Setup
SetupIconFile=
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; Run as user — no admin required unless installing to Program Files
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
UninstallDisplayIcon={app}\{#AppExeName}

; Minimum Windows 10
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon";   Description: "Create a &desktop shortcut";   GroupDescription: "Additional shortcuts:"; Flags: unchecked
Name: "startupicon";   Description: "Start DartVoice with &Windows"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
; Bundle the entire PyInstaller output folder
Source: "{#SourceDir}\{#AppExeName}";  DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceDir}\_internal\*";    DestDir: "{app}\_internal"; Flags: ignoreversion recursesubdirs createallsubdirs
; Vosk model (large — bundled inside _internal via PyInstaller spec already)

[Icons]
; Start Menu
Name: "{group}\{#AppName}";           Filename: "{app}\{#AppExeName}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
; Desktop (optional)
Name: "{autodesktop}\{#AppName}";     Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
; Start with Windows (optional task)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run";
  ValueType: string; ValueName: "DartVoice";
  ValueData: """{app}\{#AppExeName}""";
  Flags: uninsdeletevalue; Tasks: startupicon

[Run]
; Launch after install
Filename: "{app}\{#AppExeName}"; \
  Description: "Launch {#AppName}"; \
  Flags: nowait postinstall skipifsilent

[UninstallRun]
; Clean up the tray process on uninstall
Filename: "taskkill"; Parameters: "/f /im {#AppExeName}"; Flags: runhidden; RunOnceId: "KillDartVoice"

[Code]
// Show a friendly welcome message on the first page
procedure InitializeWizard();
begin
  WizardForm.WelcomeLabel2.Caption :=
    'DartVoice is a voice-controlled darts scorer.' + #13#10 +
    'Just say your score and it''s entered automatically.' + #13#10#13#10 +
    'This installer will set up DartVoice on your computer.' + #13#10 +
    'No other software is required.';
end;

; DartVoice — Windows Installer
; Built with Inno Setup 6  (free download: jrsoftware.org/isinfo.php)
;
; HOW TO BUILD:
;   1. Run build_windows.bat  (does everything automatically)
;      OR manually:
;   2. pyinstaller DartVoice.spec --noconfirm
;   3. Open this file in Inno Setup → Build → Compile  (Ctrl+F9)
;   4. Installer:  installer_output\DartVoice_Setup.exe

#define AppName      "DartVoice"
#define AppVersion   "1.7"
#define AppPublisher "DartVoice"
#define AppURL       "https://dartvoice.com"
#define AppExeName   "DartVoice.exe"
#define SourceDir    "dist\DartVoice"

[Setup]
AppId={{8F3A2D1E-4C7B-4A9F-B2E6-1D5C8F9A3B7E}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}/support
AppUpdatesURL={#AppURL}

; Install location
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes

; Output
OutputDir=installer_output
OutputBaseFilename=DartVoice_Setup_v{#AppVersion}

; Appearance
WizardStyle=modern
WizardSizePercent=120

; Compression
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; Privileges — prefer user-level, offer admin if needed
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; Windows 10+ only
MinVersion=10.0

; Uninstall
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName} v{#AppVersion}

; No restart needed
RestartIfNeededByRun=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut";      GroupDescription: "Shortcuts:"; Flags: unchecked
Name: "startuprun";  Description: "Start DartVoice with &Windows";   GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
; Main executable
Source: "{#SourceDir}\{#AppExeName}";   DestDir: "{app}"; Flags: ignoreversion

; Everything PyInstaller bundled into _internal
Source: "{#SourceDir}\_internal\*";     DestDir: "{app}\_internal"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Start Menu
Name: "{group}\{#AppName}";             Filename: "{app}\{#AppExeName}"
Name: "{group}\Uninstall {#AppName}";   Filename: "{uninstallexe}"

; Desktop (optional task)
Name: "{autodesktop}\{#AppName}";       Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "DartVoice"; ValueData: """{app}\{#AppExeName}"""; Flags: uninsdeletevalue; Tasks: startuprun

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName} now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Kill the process cleanly before uninstalling
Filename: "taskkill"; Parameters: "/f /im {#AppExeName}"; Flags: runhidden; RunOnceId: "KillDartVoice"

[Code]

// ── Welcome page custom text ──────────────────────────────────────────────────
procedure InitializeWizard();
begin
  WizardForm.WelcomeLabel1.Caption := 'Welcome to DartVoice v{#AppVersion}';
  WizardForm.WelcomeLabel2.Caption :=
    'The voice-activated darts scorer.' + #13#10#13#10 +
    'Just say your score — DartVoice types it into' + #13#10 +
    'Target Dartcounter, Lidarts, or any scoring app' + #13#10 +
    'automatically. No hands. No keyboard.' + #13#10#13#10 +
    'Works with X01 and Cricket.' + #13#10#13#10 +
    'This wizard will install DartVoice on your PC.' + #13#10 +
    'No other software is required.';
end;

// ── Detect existing running instance and offer to close it ───────────────────
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  if CheckForMutexes('DartVoiceRunning') then
  begin
    if MsgBox(
      'DartVoice is currently running.' + #13#10 +
      'Click OK to close it and continue with the installation.',
      mbConfirmation, MB_OKCANCEL
    ) = IDOK then
    begin
      Exec('taskkill', '/f /im {#AppExeName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(800);
    end
    else
      Result := False;
  end;
end;

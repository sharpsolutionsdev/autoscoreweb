param([string]$Sql = "migrations/025_competitions_payment_links.sql")

if (-not ([System.Management.Automation.PSTypeName]'CredX').Type) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CredX {
  [DllImport("Advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr CredentialPtr);
  [DllImport("Advapi32.dll")] public static extern void CredFree(IntPtr cred);
  [StructLayout(LayoutKind.Sequential)]
  public struct CREDENTIAL {
    public int Flags; public int Type;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
    [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
    public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
    public int Persist; public int AttributeCount; public IntPtr Attributes;
    [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
    [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
  }
  public static string Read(string target) {
    IntPtr p; if(!CredRead(target,1,0,out p)) return null;
    var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
    var bytes = new byte[c.CredentialBlobSize];
    Marshal.Copy(c.CredentialBlob, bytes, 0, c.CredentialBlobSize);
    CredFree(p);
    return Encoding.UTF8.GetString(bytes);
  }
}
'@
}

$tok = [CredX]::Read('Supabase CLI:supabase')
if (-not $tok) { Write-Host "no token in credential manager"; exit 1 }
Write-Host "token: $($tok.Substring(0,10))... len=$($tok.Length)"

$sqlText = [string](Get-Content -Raw $Sql)
# Manually escape for JSON to avoid PS5.1 ConvertTo-Json quirks with multiline.
$esc = $sqlText -replace '\\','\\' -replace '"','\"' -replace "`r",'' -replace "`n",'\n' -replace "`t",'\t'
$payload = '{"query":"' + $esc + '"}'
$h = @{ Authorization = "Bearer $tok"; 'Content-Type' = 'application/json' }
Write-Host "payload len $($payload.Length)"

try {
  $r = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/poyjykgqsvgimssbhsuz/database/query" -Method Post -Headers $h -Body $payload -TimeoutSec 60
  Write-Host "OK"
  $r | ConvertTo-Json -Depth 6
} catch {
  Write-Host "ERR: $($_.Exception.Message)"
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  exit 1
}

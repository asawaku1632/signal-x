using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

internal static class NativeWindowsAclInspectorHelper
{
    [StructLayout(LayoutKind.Sequential)]
    private struct ByHandleFileInformation
    {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME CreationTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastAccessTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWriteTime;
        public uint VolumeSerialNumber;
        public uint FileSizeHigh;
        public uint FileSizeLow;
        public uint NumberOfLinks;
        public uint FileIndexHigh;
        public uint FileIndexLow;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out ByHandleFileInformation info);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandle(SafeFileHandle handle, StringBuilder path, uint length, uint flags);

    private static string Json(string value)
    {
        if (value == null) return "null";
        var output = new StringBuilder("\"");
        foreach (char character in value)
        {
            if (character == '\\' || character == '"') output.Append('\\').Append(character);
            else if (character < 32) output.Append("\\u").Append(((int)character).ToString("x4"));
            else output.Append(character);
        }
        return output.Append('"').ToString();
    }

    private static string Principal(IdentityReference identity)
    {
        return identity.Value;
    }

    private static List<string> Permissions(FileSystemRights rights)
    {
        var values = new List<string>();
        if ((rights & FileSystemRights.FullControl) == FileSystemRights.FullControl) values.Add("FULL_CONTROL");
        if ((rights & FileSystemRights.Read) == FileSystemRights.Read) values.Add("READ");
        if ((rights & FileSystemRights.ReadAttributes) != 0) values.Add("READ_ATTRIBUTES");
        if ((rights & FileSystemRights.ReadPermissions) != 0) values.Add("READ_PERMISSIONS");
        if ((rights & FileSystemRights.Traverse) != 0) values.Add("TRAVERSE");
        if ((rights & FileSystemRights.ExecuteFile) != 0) values.Add("EXECUTE");
        if ((rights & FileSystemRights.Write) == FileSystemRights.Write) values.Add("WRITE");
        if ((rights & FileSystemRights.WriteData) != 0) values.Add("WRITE_DATA");
        if ((rights & FileSystemRights.AppendData) != 0) values.Add("APPEND_DATA");
        if ((rights & FileSystemRights.WriteExtendedAttributes) != 0) values.Add("WRITE_EXTENDED_ATTRIBUTES");
        if ((rights & FileSystemRights.WriteAttributes) != 0) values.Add("WRITE_ATTRIBUTES");
        if ((rights & FileSystemRights.Modify) == FileSystemRights.Modify) values.Add("MODIFY");
        if ((rights & FileSystemRights.Delete) != 0) values.Add("DELETE");
        if ((rights & FileSystemRights.DeleteSubdirectoriesAndFiles) != 0) values.Add("DELETE_CHILD");
        if ((rights & FileSystemRights.ChangePermissions) != 0) values.Add("CHANGE_PERMISSIONS");
        if ((rights & FileSystemRights.TakeOwnership) != 0) values.Add("TAKE_OWNERSHIP");
        return values;
    }

    private static string Inspect(string inputPath)
    {
        string absolute = Path.GetFullPath(inputPath);
        FileAttributes attributes = File.GetAttributes(absolute);
        bool directory = (attributes & FileAttributes.Directory) != 0;
        FileSystemSecurity security = directory
            ? (FileSystemSecurity)new DirectoryInfo(absolute).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access)
            : new FileInfo(absolute).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Access);
        var owner = security.GetOwner(typeof(SecurityIdentifier));
        AuthorizationRuleCollection rules = security.GetAccessRules(true, true, typeof(SecurityIdentifier));
        var entries = new StringBuilder("[");
        bool first = true;
        foreach (FileSystemAccessRule rule in rules)
        {
            if (!first) entries.Append(',');
            first = false;
            List<string> permissions = Permissions(rule.FileSystemRights);
            entries.Append("{\"principal\":").Append(Json(Principal(rule.IdentityReference))).Append(",\"sid\":").Append(Json(rule.IdentityReference.Value));
            entries.Append(",\"inherited\":").Append(rule.IsInherited ? "true" : "false").Append(",\"allow\":").Append(rule.AccessControlType == AccessControlType.Allow ? "true" : "false");
            entries.Append(",\"permissions\":[");
            for (int index = 0; index < permissions.Count; index++) { if (index > 0) entries.Append(','); entries.Append(Json(permissions[index])); }
            entries.Append("]}");
        }
        entries.Append(']');

        const uint ReadControl = 0x00020000;
        const uint ReadAttributes = 0x00000080;
        const uint ShareAll = 0x00000007;
        const uint OpenExisting = 3;
        const uint BackupSemantics = 0x02000000;
        using (SafeFileHandle handle = CreateFile(absolute, ReadControl | ReadAttributes, ShareAll, IntPtr.Zero, OpenExisting, BackupSemantics, IntPtr.Zero))
        {
            if (handle.IsInvalid) throw new InvalidOperationException("HANDLE_OPEN_FAILED");
            ByHandleFileInformation info;
            if (!GetFileInformationByHandle(handle, out info)) throw new InvalidOperationException("FILE_ID_UNAVAILABLE");
            var finalPath = new StringBuilder(32768);
            uint finalLength = GetFinalPathNameByHandle(handle, finalPath, (uint)finalPath.Capacity, 0);
            if (finalLength == 0 || finalLength >= finalPath.Capacity) throw new InvalidOperationException("FINAL_PATH_UNAVAILABLE");
            ulong fileId = ((ulong)info.FileIndexHigh << 32) | info.FileIndexLow;
            long size = ((long)info.FileSizeHigh << 32) | info.FileSizeLow;
            long lastWrite = ((long)(uint)info.LastWriteTime.dwHighDateTime << 32) | (uint)info.LastWriteTime.dwLowDateTime;
            return "{\"ok\":true,\"available\":true,\"absolutePath\":" + Json(absolute)
                + ",\"resolvedPath\":" + Json(finalPath.ToString())
                + ",\"type\":" + Json(directory ? "directory" : "file")
                + ",\"owner\":" + Json(Principal(owner))
                + ",\"ownerSidPresent\":true"
                + ",\"inheritanceEnabled\":" + (security.AreAccessRulesProtected ? "false" : "true")
                + ",\"isReparsePoint\":" + (((attributes & FileAttributes.ReparsePoint) != 0) ? "true" : "false")
                + ",\"volumeSerial\":" + Json(info.VolumeSerialNumber.ToString("x8"))
                + ",\"fileId\":" + Json(fileId.ToString("x16"))
                + ",\"size\":" + size.ToString()
                + ",\"lastWriteFileTime\":" + lastWrite.ToString()
                + ",\"entries\":" + entries.ToString() + "}";
        }
    }

    public static int Main(string[] args)
    {
        try
        {
            if (args.Length != 2 || args[0] != "inspect") throw new InvalidOperationException("INVALID_REQUEST");
            Console.Out.Write(Inspect(args[1]));
            return 0;
        }
        catch
        {
            Console.Out.Write("{\"ok\":false,\"classification\":\"NATIVE_INSPECTOR_FAILED\"}");
            return 2;
        }
    }
}

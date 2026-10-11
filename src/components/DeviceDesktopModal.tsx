import React, { useState, useMemo } from 'react';
import {
  X,
  Monitor,
  Globe,
  Terminal,
  Server,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Share2,
  Download,
  Upload,
  HardDrive,
  Network,
  Save,
  Lock,
  Unlock,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowLeft,
  Edit3,
  Copy,
  Check,
  Wifi,
  ShieldCheck,
} from 'lucide-react';
import {
  DeviceFileSystem,
  NetworkDevice,
  NetworkLink,
  SimulationSession,
  VirtualFileNode,
} from '../types/network';
import { runPacketSimulation } from '../engine/simulationEngine';
import { createDefaultFileSystem } from '../utils/networkMath';

interface DeviceDesktopModalProps {
  device: NetworkDevice;
  allDevices: NetworkDevice[];
  links: NetworkLink[];
  onClose: () => void;
  onUpdateDevice: (updated: NetworkDevice) => void;
  onUpdateMultipleDevices?: (updatedDevices: NetworkDevice[]) => void;
  onRequestDhcp: (deviceId: string) => void;
  onOpenCli: (deviceId: string) => void;
  onSimulationGenerated: (session: SimulationSession, updatedDevices: NetworkDevice[]) => void;
}

export const DeviceDesktopModal: React.FC<DeviceDesktopModalProps> = ({
  device,
  allDevices,
  links,
  onClose,
  onUpdateDevice,
  onUpdateMultipleDevices,
  onRequestDhcp,
  onOpenCli,
  onSimulationGenerated,
}) => {
  const [activeApp, setActiveApp] = useState<
    'files' | 'ip' | 'browser' | 'dns' | 'ping' | 'services'
  >('files');

  // Ensure device has a fileSystem initialized
  const localFs: DeviceFileSystem = useMemo(() => {
    return device.fileSystem || createDefaultFileSystem(device.name, device.type);
  }, [device]);

  // ============================================================================
  // FILE MANAGER & SMB/FTP NETWORK SHARING STATE
  // ============================================================================
  const [storageMode, setStorageMode] = useState<'local' | 'remote'>('local');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<'grid' | 'details'>('grid');
  const [fileSearch, setFileSearch] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Remote Network Share Connection State
  const [remoteHostInput, setRemoteHostInput] = useState('');
  const [shareProtocol, setShareProtocol] = useState<'SMB' | 'FTP'>('SMB');
  const [connectedRemoteDeviceId, setConnectedRemoteDeviceId] = useState<string | null>(null);
  const [shareStatusBanner, setShareStatusBanner] = useState<{
    type: 'idle' | 'success' | 'error' | 'info';
    message: string;
  }>({
    type: 'idle',
    message: 'Select a discovered LAN host or enter \\\\IP_Address to mount a shared network drive.',
  });

  // Live Real-Time File Editor State
  const [editingFile, setEditingFile] = useState<{
    fileId: string;
    ownerDeviceId: string;
    name: string;
    content: string;
    isShared: boolean;
    permissions: VirtualFileNode['permissions'];
    dirty: boolean;
    lastSavedToast?: string;
  } | null>(null);

  // New File / Folder Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemShared, setNewItemShared] = useState(true);

  // Rename State
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Browser state
  const [browserUrl, setBrowserUrl] = useState('http://192.168.10.10');
  const [browserResult, setBrowserResult] = useState<{
    status: 'idle' | 'ok' | 'error';
    title?: string;
    html?: string;
    message?: string;
  }>({ status: 'idle' });

  // DNS Lookup state
  const [dnsQueryHost, setDnsQueryHost] = useState('intranet.netlab.edu');
  const [dnsOutput, setDnsOutput] = useState<string>('');

  // Ping Diagnostic state
  const [pingTarget, setPingTarget] = useState('192.168.1.20');
  const [pingOutput, setPingOutput] = useState<string>('');

  // Server new DNS record
  const [newDnsHost, setNewDnsHost] = useState('');
  const [newDnsIp, setNewDnsIp] = useState('');

  const primaryIntf = device.interfaces[0];

  // Discover other PCs, Laptops, and Servers in the topology with File Systems
  const peerWorkstations = useMemo(() => {
    return allDevices.filter(
      (d) =>
        d.id !== device.id &&
        (d.type === 'pc' || d.type === 'laptop' || d.type === 'server') &&
        d.interfaces[0]?.ipAddress
    );
  }, [allDevices, device.id]);

  const connectedRemoteDevice = useMemo(() => {
    if (!connectedRemoteDeviceId) return null;
    return allDevices.find((d) => d.id === connectedRemoteDeviceId) || null;
  }, [allDevices, connectedRemoteDeviceId]);

  const activeFileSystem: DeviceFileSystem = useMemo(() => {
    if (storageMode === 'remote' && connectedRemoteDevice) {
      return (
        connectedRemoteDevice.fileSystem ||
        createDefaultFileSystem(connectedRemoteDevice.name, connectedRemoteDevice.type)
      );
    }
    return localFs;
  }, [storageMode, connectedRemoteDevice, localFs]);

  // Filter visible files/folders for current view
  const displayedItems = useMemo(() => {
    let items = activeFileSystem.files;

    if (storageMode === 'remote') {
      // When browsing a remote network share, show shared folders/files or items inside a shared folder
      if (currentFolderId === null) {
        items = items.filter((item) => item.isShared);
      } else {
        items = items.filter((item) => item.parentId === currentFolderId);
      }
    } else {
      items = items.filter((item) => item.parentId === currentFolderId);
    }

    if (fileSearch.trim()) {
      const q = fileSearch.toLowerCase();
      items = activeFileSystem.files.filter(
        (item) =>
          (storageMode === 'local' || item.isShared) &&
          (item.name.toLowerCase().includes(q) ||
            (item.content && item.content.toLowerCase().includes(q)))
      );
    }

    // Folders first, then alphabetical
    return [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [activeFileSystem, storageMode, currentFolderId, fileSearch]);

  const currentFolderNode = useMemo(() => {
    if (!currentFolderId) return null;
    return activeFileSystem.files.find((f) => f.id === currentFolderId) || null;
  }, [activeFileSystem, currentFolderId]);

  // Helper to update a device's fileSystem (either local or remote peer)
  const commitFileSystemChange = (targetDeviceId: string, updatedFs: DeviceFileSystem) => {
    const targetDev = allDevices.find((d) => d.id === targetDeviceId);
    if (!targetDev) return;

    // Also sync index.html with Server HTTP content if modified on a server!
    let updatedServices = targetDev.services;
    const indexHtmlFile = updatedFs.files.find(
      (f) => f.type === 'file' && f.name.toLowerCase() === 'index.html'
    );
    if (targetDev.type === 'server' && updatedServices && indexHtmlFile?.content) {
      updatedServices = {
        ...updatedServices,
        httpContent: indexHtmlFile.content,
      };
    }

    const updatedTarget: NetworkDevice = {
      ...targetDev,
      fileSystem: updatedFs,
      services: updatedServices,
    };

    if (targetDeviceId === device.id) {
      onUpdateDevice(updatedTarget);
    } else if (onUpdateMultipleDevices) {
      onUpdateMultipleDevices(
        allDevices.map((d) => (d.id === targetDeviceId ? updatedTarget : d))
      );
    } else {
      onUpdateDevice(updatedTarget);
    }
  };

  // Connect to Remote SMB / FTP Share using real packet simulation
  const handleConnectRemoteShare = (targetHostOrIp: string, proto: 'SMB' | 'FTP' = shareProtocol) => {
    const cleanTarget = targetHostOrIp
      .trim()
      .replace(/^\\\\/, '')
      .replace(/^smb:\/\//i, '')
      .replace(/^ftp:\/\//i, '')
      .split('\\')[0]
      .split('/')[0];

    if (!cleanTarget) return;

    const sim = runPacketSimulation(device.id, cleanTarget, proto, allDevices, links);
    onSimulationGenerated(sim.session, sim.updatedDevices);

    if (sim.session.overallSuccess) {
      const remoteDev = sim.updatedDevices.find((d) =>
        d.interfaces.some((i) => i.ipAddress === sim.session.targetIp)
      );
      if (remoteDev) {
        setConnectedRemoteDeviceId(remoteDev.id);
        setStorageMode('remote');
        setCurrentFolderId(null);
        setSelectedFileId(null);
        setRemoteHostInput(`\\\\${sim.session.targetIp}\\${remoteDev.fileSystem?.shareName || 'Shared'}`);
        setShareStatusBanner({
          type: 'success',
          message: `Connected via ${proto} (TCP Port ${proto === 'SMB' ? 445 : 21}) to \\\\${remoteDev.name} (${sim.session.targetIp}) in ${sim.session.rttMs || 4}ms.`,
        });
      }
    } else {
      setConnectedRemoteDeviceId(null);
      setShareStatusBanner({
        type: 'error',
        message: sim.session.summaryMessage,
      });
    }
  };

  // Open a file in the Live Editor
  const handleOpenItem = (item: VirtualFileNode) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
      setSelectedFileId(null);
      return;
    }

    const ownerId =
      storageMode === 'remote' && connectedRemoteDevice ? connectedRemoteDevice.id : device.id;

    setEditingFile({
      fileId: item.id,
      ownerDeviceId: ownerId,
      name: item.name,
      content: item.content || '',
      isShared: item.isShared,
      permissions: item.permissions,
      dirty: false,
    });
  };

  // Save File Content (triggers SMB/FTP packet simulation if saving to a remote network share!)
  const handleSaveEditedFile = () => {
    if (!editingFile) return;

    const ownerDev = allDevices.find((d) => d.id === editingFile.ownerDeviceId);
    if (!ownerDev) return;

    const ownerFs =
      ownerDev.fileSystem || createDefaultFileSystem(ownerDev.name, ownerDev.type);

    // If editing remotely over the network, verify write permission and trigger packet simulation
    if (editingFile.ownerDeviceId !== device.id) {
      if (!ownerFs.allowRemoteWrite || editingFile.permissions === 'r--r--r--') {
        setShareStatusBanner({
          type: 'error',
          message: `Access Denied: Remote share on ${ownerDev.name} is Read-Only.`,
        });
        return;
      }

      const remoteIp = ownerDev.interfaces[0]?.ipAddress || ownerDev.name;
      const sim = runPacketSimulation(device.id, remoteIp, shareProtocol, allDevices, links);
      onSimulationGenerated(sim.session, sim.updatedDevices);

      if (!sim.session.overallSuccess) {
        setShareStatusBanner({
          type: 'error',
          message: `Network Sync Failed while saving to ${ownerDev.name}: ${sim.session.summaryMessage}`,
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const byteLen = new TextEncoder().encode(editingFile.content).length;

    const updatedFiles = ownerFs.files.map((f) =>
      f.id === editingFile.fileId
        ? {
            ...f,
            name: editingFile.name,
            content: editingFile.content,
            isShared: editingFile.isShared,
            permissions: editingFile.permissions,
            sizeBytes: byteLen,
            authorDeviceName: `${device.name} (${primaryIntf?.ipAddress || 'local'})`,
            updatedAt: now,
          }
        : f
    );

    commitFileSystemChange(ownerDev.id, {
      ...ownerFs,
      files: updatedFiles,
    });

    setEditingFile({
      ...editingFile,
      dirty: false,
      lastSavedToast:
        editingFile.ownerDeviceId === device.id
          ? `Saved locally to ${device.name} disk (${byteLen} bytes)`
          : `Synced live over ${shareProtocol} to ${ownerDev.name} (${byteLen} bytes)`,
    });
  };

  // Create New File or Folder
  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !showCreateModal) return;

    const targetDevId =
      storageMode === 'remote' && connectedRemoteDevice ? connectedRemoteDevice.id : device.id;
    const targetDev = allDevices.find((d) => d.id === targetDevId);
    if (!targetDev) return;

    const targetFs =
      targetDev.fileSystem || createDefaultFileSystem(targetDev.name, targetDev.type);

    if (storageMode === 'remote' && !targetFs.allowRemoteWrite) {
      setShareStatusBanner({
        type: 'error',
        message: `Permission Denied: Remote share \\\\${targetDev.name}\\${targetFs.shareName} is Read-Only.`,
      });
      setShowCreateModal(null);
      return;
    }

    const cleanName = newItemName.trim();
    const extMatch = cleanName.split('.').pop()?.toLowerCase();
    const ext = (
      ['txt', 'conf', 'html', 'json', 'log', 'md', 'csv'].includes(extMatch || '')
        ? extMatch
        : 'txt'
    ) as VirtualFileNode['extension'];

    const defaultContent =
      showCreateModal === 'file'
        ? `# ${cleanName}\nCreated on ${device.name} (${primaryIntf?.ipAddress || 'local'}) at ${new Date().toLocaleTimeString()}\n\nWrite your configuration notes, subnet documentation, or shared data here...`
        : undefined;

    const newNode: VirtualFileNode = {
      id: `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      type: showCreateModal,
      parentId: currentFolderId,
      extension: showCreateModal === 'file' ? ext : undefined,
      content: defaultContent,
      sizeBytes: defaultContent ? defaultContent.length : 0,
      permissions: newItemShared ? 'rw-rw-rw-' : 'rw-r--r--',
      isShared: storageMode === 'remote' ? true : newItemShared,
      authorDeviceName: device.name,
      updatedAt: new Date().toISOString(),
    };

    commitFileSystemChange(targetDevId, {
      ...targetFs,
      files: [...targetFs.files, newNode],
    });

    setNewItemName('');
    setShowCreateModal(null);

    if (newNode.type === 'file') {
      handleOpenItem(newNode);
    }
  };

  // Delete File or Folder
  const handleDeleteItem = (itemId: string) => {
    const targetDevId =
      storageMode === 'remote' && connectedRemoteDevice ? connectedRemoteDevice.id : device.id;
    const targetDev = allDevices.find((d) => d.id === targetDevId);
    if (!targetDev) return;
    const targetFs =
      targetDev.fileSystem || createDefaultFileSystem(targetDev.name, targetDev.type);

    if (storageMode === 'remote' && !targetFs.allowRemoteWrite) {
      setShareStatusBanner({
        type: 'error',
        message: `Permission Denied: Cannot delete files on Read-Only share \\\\${targetDev.name}.`,
      });
      return;
    }

    const updatedFiles = targetFs.files.filter(
      (f) => f.id !== itemId && f.parentId !== itemId
    );
    commitFileSystemChange(targetDevId, {
      ...targetFs,
      files: updatedFiles,
    });
    if (selectedFileId === itemId) setSelectedFileId(null);
    if (editingFile?.fileId === itemId) setEditingFile(null);
  };

  // Toggle Shared status on a file/folder
  const handleToggleItemShare = (item: VirtualFileNode) => {
    const targetDevId =
      storageMode === 'remote' && connectedRemoteDevice ? connectedRemoteDevice.id : device.id;
    const targetDev = allDevices.find((d) => d.id === targetDevId);
    if (!targetDev) return;
    const targetFs =
      targetDev.fileSystem || createDefaultFileSystem(targetDev.name, targetDev.type);

    const updatedFiles = targetFs.files.map((f) =>
      f.id === item.id ? { ...f, isShared: !f.isShared } : f
    );
    commitFileSystemChange(targetDevId, {
      ...targetFs,
      files: updatedFiles,
    });
  };

  // Transfer (Download from Remote to Local OR Upload from Local to Remote) over SMB/FTP
  const handleTransferFileOverNetwork = (
    item: VirtualFileNode,
    direction: 'download-to-local' | 'upload-to-remote',
    targetPeerDevice?: NetworkDevice
  ) => {
    const remotePeer = targetPeerDevice || connectedRemoteDevice;
    if (!remotePeer) {
      setShareStatusBanner({
        type: 'error',
        message: 'Connect to a remote PC or Server first to transfer files across the network.',
      });
      return;
    }

    const remoteIp = remotePeer.interfaces[0]?.ipAddress || remotePeer.name;
    const sim = runPacketSimulation(device.id, remoteIp, shareProtocol, allDevices, links);
    onSimulationGenerated(sim.session, sim.updatedDevices);

    if (!sim.session.overallSuccess) {
      setShareStatusBanner({
        type: 'error',
        message: `File Transfer Failed: ${sim.session.summaryMessage}`,
      });
      return;
    }

    const now = new Date().toISOString();
    if (direction === 'download-to-local') {
      // Copy item into local Shared_Network_Folder or root
      const sharedDir = localFs.files.find(
        (f) => f.type === 'folder' && f.isShared
      );
      const clonedFile: VirtualFileNode = {
        ...item,
        id: `dl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: item.name,
        parentId: sharedDir ? sharedDir.id : null,
        authorDeviceName: `${item.authorDeviceName} (via ${remotePeer.name})`,
        updatedAt: now,
      };
      commitFileSystemChange(device.id, {
        ...localFs,
        files: [...localFs.files, clonedFile],
      });
      setShareStatusBanner({
        type: 'success',
        message: `Downloaded "${item.name}" (${item.sizeBytes} B) from \\\\${remotePeer.name} to local drive in ${sim.session.rttMs || 4}ms!`,
      });
    } else {
      // Upload item from local drive to remotePeer's shared folder
      const peerFs =
        remotePeer.fileSystem || createDefaultFileSystem(remotePeer.name, remotePeer.type);
      if (!peerFs.allowRemoteWrite) {
        setShareStatusBanner({
          type: 'error',
          message: `Upload Rejected: \\\\${remotePeer.name}\\${peerFs.shareName} is Read-Only.`,
        });
        return;
      }
      const peerSharedDir = peerFs.files.find(
        (f) => f.type === 'folder' && f.isShared
      );
      const uploadedFile: VirtualFileNode = {
        ...item,
        id: `ul-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        parentId: peerSharedDir ? peerSharedDir.id : null,
        isShared: true,
        authorDeviceName: `${device.name} (${primaryIntf?.ipAddress || 'remote'})`,
        updatedAt: now,
      };
      commitFileSystemChange(remotePeer.id, {
        ...peerFs,
        files: [...peerFs.files, uploadedFile],
      });
      setShareStatusBanner({
        type: 'success',
        message: `Uploaded "${item.name}" (${item.sizeBytes} B) to \\\\${remotePeer.name}\\${peerFs.shareName} via ${shareProtocol} (${sim.session.rttMs || 4}ms)!`,
      });
    }
  };

  // ============================================================================
  // OTHER DESKTOP APPS HANDLERS (HTTP, DNS, PING)
  // ============================================================================
  const handleBrowserGo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = browserUrl
      .trim()
      .replace(/^https?:\/\//i, '')
      .split('/')[0];

    const sim = runPacketSimulation(device.id, cleanTarget, 'HTTP', allDevices, links);
    onSimulationGenerated(sim.session, sim.updatedDevices);

    if (sim.session.overallSuccess) {
      const targetSrv = allDevices.find((d) =>
        d.interfaces.some((i) => i.ipAddress === sim.session.targetIp)
      );
      const indexHtml = targetSrv?.fileSystem?.files.find(
        (f) => f.type === 'file' && f.name.toLowerCase() === 'index.html'
      );
      setBrowserResult({
        status: 'ok',
        title: `${targetSrv?.name || cleanTarget} — HTTP 200 OK`,
        html:
          indexHtml?.content ||
          targetSrv?.services?.httpContent ||
          `<h1>Welcome to ${cleanTarget}</h1><p>Connection verified via NetLab HTTP Engine.</p>`,
      });
    } else {
      setBrowserResult({
        status: 'error',
        message: sim.session.summaryMessage,
      });
    }
  };

  const handleDnsLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const sim = runPacketSimulation(device.id, dnsQueryHost.trim(), 'DNS', allDevices, links);
    onSimulationGenerated(sim.session, sim.updatedDevices);
    if (sim.session.overallSuccess) {
      setDnsOutput(
        `Server:  ${device.dnsServer}\nAddress: ${device.dnsServer}#53\n\nNon-authoritative answer:\nName:    ${dnsQueryHost}\nAddress: ${sim.session.targetIp}`
      );
    } else {
      setDnsOutput(`;; connection timed out or NXDOMAIN:\n${sim.session.summaryMessage}`);
    }
  };

  const handleRunPingDiag = (e: React.FormEvent) => {
    e.preventDefault();
    const sim = runPacketSimulation(device.id, pingTarget.trim(), 'ICMP', allDevices, links);
    onSimulationGenerated(sim.session, sim.updatedDevices);
    const lines = [
      `Pinging ${pingTarget} (${sim.session.targetIp}) from ${primaryIntf?.ipAddress || 'unconfigured'}:`,
      ...sim.session.events.map((ev) => `  [Step ${ev.stepIndex}] ${ev.protocol}: ${ev.summary}`),
      '',
      sim.session.summaryMessage,
    ];
    setPingOutput(lines.join('\n'));
  };

  const totalLocalBytes = useMemo(
    () => localFs.files.reduce((sum, f) => sum + f.sizeBytes, 0),
    [localFs.files]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-5xl liquid-glass bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[820px]">
        {/* Modal Top OS Window Bar */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">
              {device.name} ({device.model}) — Workstation OS &amp; File Sharing Suite
            </h2>
            {primaryIntf?.ipAddress && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 font-mono text-[11px] text-cyan-300">
                IPv4: {primaryIntf.ipAddress}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close Desktop Window"
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Application Switcher Bar */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveApp('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeApp === 'files'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            File Manager &amp; Network Share
          </button>
          <button
            onClick={() => setActiveApp('ip')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeApp === 'ip'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            IP Configuration
          </button>
          <button
            onClick={() => setActiveApp('browser')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeApp === 'browser'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Web Browser (HTTP)
          </button>
          <button
            onClick={() => setActiveApp('dns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeApp === 'dns'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            DNS Lookup
          </button>
          <button
            onClick={() => setActiveApp('ping')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeApp === 'ping'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Packet Diagnostics
          </button>
          {device.type === 'server' && (
            <button
              onClick={() => setActiveApp('services')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeApp === 'services'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-emerald-300 hover:bg-slate-800'
              }`}
            >
              Server Daemons (HTTP / DHCP / DNS)
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              onOpenCli(device.id);
            }}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300"
          >
            <Terminal className="w-3.5 h-3.5" /> Command Prompt
          </button>
        </div>

        {/* =====================================================================
            FILE MANAGER & REAL-TIME NETWORK FILE SHARING SIMULATOR
           ===================================================================== */}
        {activeApp === 'files' && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            {/* Top Explorer Address & UNC Network Share Bar */}
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center gap-2 shrink-0">
              {/* Back / Up Directory Button */}
              <button
                onClick={() => {
                  if (editingFile) {
                    setEditingFile(null);
                  } else if (currentFolderId) {
                    setCurrentFolderId(null);
                  } else if (storageMode === 'remote') {
                    setStorageMode('local');
                    setConnectedRemoteDeviceId(null);
                  }
                }}
                disabled={!currentFolderId && storageMode === 'local' && !editingFile}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
                title="Navigate Up"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Current Path Breadcrumb */}
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 min-w-[220px] flex-1">
                {storageMode === 'local' ? (
                  <>
                    <HardDrive className="w-3.5 h-3.5 text-cyan-400 mr-1 shrink-0" />
                    <button
                      onClick={() => {
                        setCurrentFolderId(null);
                        setEditingFile(null);
                      }}
                      className="hover:text-cyan-400 font-semibold"
                    >
                      C:\Users\{device.hostname}
                    </button>
                  </>
                ) : (
                  <>
                    <Network className="w-3.5 h-3.5 text-emerald-400 mr-1 shrink-0" />
                    <button
                      onClick={() => {
                        setCurrentFolderId(null);
                        setEditingFile(null);
                      }}
                      className="hover:text-emerald-400 font-semibold text-emerald-300"
                    >
                      \\{connectedRemoteDevice?.interfaces[0]?.ipAddress || connectedRemoteDevice?.name}\
                      {activeFileSystem.shareName}
                    </button>
                  </>
                )}
                {currentFolderNode && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-cyan-300 font-semibold">{currentFolderNode.name}</span>
                  </>
                )}
                {editingFile && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-amber-300 font-semibold">{editingFile.name} (Live Editor)</span>
                  </>
                )}
              </div>

              {/* Direct Remote UNC / SMB / FTP Connect Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConnectRemoteShare(remoteHostInput, shareProtocol);
                }}
                className="flex items-center gap-1.5"
              >
                <select
                  value={shareProtocol}
                  onChange={(e) => setShareProtocol(e.target.value as 'SMB' | 'FTP')}
                  aria-label="File Sharing Protocol"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 font-mono text-[11px] text-cyan-300"
                >
                  <option value="SMB">SMB (TCP 445)</option>
                  <option value="FTP">FTP (TCP 21)</option>
                </select>
                <input
                  type="text"
                  value={remoteHostInput}
                  onChange={(e) => setRemoteHostInput(e.target.value)}
                  placeholder="\\192.168.10.10 or Hostname"
                  className="w-44 sm:w-52 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" /> Mount Share
                </button>
              </form>
            </div>

            {/* Network Share Status & Packet Verification Banner */}
            {shareStatusBanner.type !== 'idle' && (
              <div
                className={`px-4 py-2 border-b flex items-center justify-between text-[11px] shrink-0 ${
                  shareStatusBanner.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-200'
                    : shareStatusBanner.type === 'error'
                    ? 'bg-rose-950/60 border-rose-500/30 text-rose-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {shareStatusBanner.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{shareStatusBanner.message}</span>
                </div>
                <span className="font-mono text-[10px] opacity-75 hidden sm:inline">
                  Packet animated on canvas
                </span>
              </div>
            )}

            {/* Main 3-Column Explorer Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Navigation Pane: Local Drives, Shared Folders & Discovered Network Neighborhood */}
              <div className="w-56 sm:w-64 bg-slate-950/80 border-r border-slate-800 p-3 flex flex-col justify-between overflow-y-auto shrink-0">
                <div className="space-y-4">
                  {/* Local Storage Section */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-2">
                      This Workstation ({device.name})
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setStorageMode('local');
                          setCurrentFolderId(null);
                          setEditingFile(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left font-medium transition-colors ${
                          storageMode === 'local' && currentFolderId === null
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-cyan-400" />
                          <span>Local Disk (C:)</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {localFs.files.length}
                        </span>
                      </button>

                      {/* Quick Local Folders */}
                      {localFs.files
                        .filter((f) => f.type === 'folder' && f.parentId === null)
                        .map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => {
                              setStorageMode('local');
                              setCurrentFolderId(folder.id);
                              setEditingFile(null);
                            }}
                            className={`w-full flex items-center justify-between pl-6 pr-2.5 py-1.5 rounded-lg text-left transition-colors ${
                              storageMode === 'local' && currentFolderId === folder.id
                                ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate">{folder.name}</span>
                            </span>
                            {folder.isShared && (
                              <span title="Shared on Network" className="shrink-0 flex items-center">
                                <Share2 className="w-3 h-3 text-emerald-400" />
                              </span>
                            )}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Discovered Network Neighborhood (SMB / FTP Peers) */}
                  <div>
                    <div className="flex items-center justify-between px-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Network Neighborhood
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {peerWorkstations.length} Hosts
                      </span>
                    </div>
                    {peerWorkstations.length === 0 ? (
                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
                        No other PCs or Servers with IPv4 addresses found in topology.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {peerWorkstations.map((peer) => {
                          const peerIp = peer.interfaces[0]?.ipAddress || 'Unconfigured';
                          const isConnected =
                            storageMode === 'remote' && connectedRemoteDeviceId === peer.id;
                          const peerFs = peer.fileSystem;
                          const sharedCount =
                            peerFs?.files.filter((f) => f.isShared).length ?? 3;

                          return (
                            <button
                              key={peer.id}
                              onClick={() => handleConnectRemoteShare(peerIp, shareProtocol)}
                              className={`w-full p-2 rounded-lg text-left transition-all border ${
                                isConnected
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                  : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-1.5 text-white">
                                  {peer.type === 'server' ? (
                                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                                  )}
                                  {peer.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 font-mono text-cyan-300">
                                  {peerIp}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-mono truncate">
                                  \\{peer.name}\{peerFs?.shareName || 'SharedDocs'}
                                </span>
                                <span className="text-emerald-400">{sharedCount} shared</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Local SMB / FTP Daemon Settings Card at bottom of sidebar */}
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      Local Share Settings
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {(totalLocalBytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                    <span>SMB Sharing (TCP 445)</span>
                    <input
                      type="checkbox"
                      checked={localFs.smbSharingEnabled}
                      onChange={(e) =>
                        commitFileSystemChange(device.id, {
                          ...localFs,
                          smbSharingEnabled: e.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                    <span>FTP Server (TCP 21)</span>
                    <input
                      type="checkbox"
                      checked={localFs.ftpServerEnabled}
                      onChange={(e) =>
                        commitFileSystemChange(device.id, {
                          ...localFs,
                          ftpServerEnabled: e.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between text-[11px] text-slate-300 cursor-pointer">
                    <span>Allow Remote Live-Edit</span>
                    <input
                      type="checkbox"
                      checked={localFs.allowRemoteWrite}
                      onChange={(e) =>
                        commitFileSystemChange(device.id, {
                          ...localFs,
                          allowRemoteWrite: e.target.checked,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              {/* Center & Right Pane: File Explorer Grid/Table OR Live Real-Time Collaborative File Editor */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                {/* Action Toolbar */}
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setNewItemName('');
                        setNewItemShared(true);
                        setShowCreateModal('file');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> New File
                    </button>
                    <button
                      onClick={() => {
                        setNewItemName('');
                        setNewItemShared(true);
                        setShowCreateModal('folder');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                    >
                      <Folder className="w-3.5 h-3.5 text-amber-400" /> New Folder
                    </button>

                    {storageMode === 'remote' && connectedRemoteDevice && (
                      <span className="ml-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> Live Mounted: {connectedRemoteDevice.name} (
                        {activeFileSystem.allowRemoteWrite ? 'Read/Write' : 'Read-Only'})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search Filter */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
                      <Search className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
                      <input
                        type="text"
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="Search files or content..."
                        className="bg-transparent text-white focus:outline-none w-36 sm:w-44 text-[11px]"
                      />
                    </div>

                    {/* Grid vs Details Toggle */}
                    <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
                      <button
                        onClick={() => setViewLayout('grid')}
                        className={`p-1 rounded ${
                          viewLayout === 'grid' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'
                        }`}
                        title="Icon Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setViewLayout('details')}
                        className={`p-1 rounded ${
                          viewLayout === 'details' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'
                        }`}
                        title="Detailed List View"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* New File / Folder Creation Inline Prompt */}
                {showCreateModal && (
                  <form
                    onSubmit={handleCreateNewItem}
                    className="px-4 py-2.5 bg-slate-950 border-b border-cyan-500/40 flex flex-wrap items-center gap-2"
                  >
                    <span className="font-semibold text-cyan-300">
                      Create {showCreateModal === 'file' ? 'New File' : 'New Folder'}:
                    </span>
                    <input
                      type="text"
                      autoFocus
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder={
                        showCreateModal === 'file'
                          ? 'e.g., ospf_notes.txt or index.html'
                          : 'e.g., Engineering_Docs'
                      }
                      className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-white w-56"
                    />
                    <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newItemShared}
                        onChange={(e) => setNewItemShared(e.target.checked)}
                      />
                      <span>Share on Network (SMB/FTP)</span>
                    </label>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-cyan-500 text-slate-950 font-semibold"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(null)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* Explorer Content Area OR Live Collaborative File Editor */}
                {editingFile ? (
                  <div className="flex-1 flex flex-col p-4 space-y-3 overflow-y-auto">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-5 h-5 text-cyan-400" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{editingFile.name}</span>
                            {editingFile.ownerDeviceId !== device.id ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px]">
                                REMOTE LIVE FILE (on{' '}
                                {allDevices.find((d) => d.id === editingFile.ownerDeviceId)?.name})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                                LOCAL FILE ({device.name})
                              </span>
                            )}
                            {editingFile.dirty && (
                              <span className="text-amber-400 font-semibold text-[11px]">
                                ● Unsaved Changes
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {editingFile.ownerDeviceId !== device.id
                              ? `Saving this file transmits an ${shareProtocol} write packet over the network topology to update the remote host in real time.`
                              : 'Mark this file as Shared so other PCs and Servers can open or live-edit it over the network.'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingFile.isShared}
                            onChange={(e) =>
                              setEditingFile({
                                ...editingFile,
                                isShared: e.target.checked,
                                dirty: true,
                              })
                            }
                          />
                          <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Shared on LAN</span>
                        </label>

                        <button
                          onClick={handleSaveEditedFile}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {editingFile.ownerDeviceId === device.id
                            ? 'Save to Disk'
                            : `Sync over ${shareProtocol}`}
                        </button>

                        <button
                          onClick={() => setEditingFile(null)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                        >
                          Close Editor
                        </button>
                      </div>
                    </div>

                    {editingFile.lastSavedToast && (
                      <div className="px-3 py-2 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          {editingFile.lastSavedToast}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400">
                          Real-time state synchronized
                        </span>
                      </div>
                    )}

                    <textarea
                      value={editingFile.content}
                      onChange={(e) =>
                        setEditingFile({
                          ...editingFile,
                          content: e.target.value,
                          dirty: true,
                          lastSavedToast: undefined,
                        })
                      }
                      rows={14}
                      className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed resize-none"
                      placeholder="Type file contents here..."
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-4">
                    {displayedItems.length === 0 ? (
                      <div className="h-52 flex flex-col items-center justify-center text-center text-slate-400 border border-dashed border-slate-800 rounded-xl p-6">
                        <FolderOpen className="w-8 h-8 text-slate-600 mb-2" />
                        <div className="font-semibold text-slate-300">
                          This directory is empty
                        </div>
                        <p className="text-[11px] text-slate-500 max-w-md mt-1">
                          {storageMode === 'remote'
                            ? 'No shared files found in this remote folder, or sharing is disabled on individual files.'
                            : 'Click "New File" or "New Folder" above to create documents, router config backups, or shared notes.'}
                        </p>
                      </div>
                    ) : viewLayout === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {displayedItems.map((item) => {
                          const isSelected = selectedFileId === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedFileId(item.id)}
                              onDoubleClick={() => handleOpenItem(item)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-cyan-500/10 border-cyan-500/50 shadow-sm'
                                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {item.type === 'folder' ? (
                                      <Folder className="w-6 h-6 text-amber-400 shrink-0" />
                                    ) : item.extension === 'html' || item.extension === 'conf' ? (
                                      <FileCode className="w-6 h-6 text-cyan-400 shrink-0" />
                                    ) : (
                                      <FileText className="w-6 h-6 text-blue-400 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      {renamingId === item.id ? (
                                        <form
                                          onSubmit={(e) => {
                                            e.preventDefault();
                                            if (renameText.trim()) {
                                              const targetDevId =
                                                storageMode === 'remote' && connectedRemoteDevice
                                                  ? connectedRemoteDevice.id
                                                  : device.id;
                                              const updatedFiles = activeFileSystem.files.map((f) =>
                                                f.id === item.id
                                                  ? { ...f, name: renameText.trim() }
                                                  : f
                                              );
                                              commitFileSystemChange(targetDevId, {
                                                ...activeFileSystem,
                                                files: updatedFiles,
                                              });
                                            }
                                            setRenamingId(null);
                                          }}
                                        >
                                          <input
                                            type="text"
                                            autoFocus
                                            value={renameText}
                                            onChange={(e) => setRenameText(e.target.value)}
                                            onBlur={() => setRenamingId(null)}
                                            className="bg-slate-900 border border-cyan-500 rounded px-1.5 py-0.5 text-white font-mono text-xs w-full"
                                          />
                                        </form>
                                      ) : (
                                        <div className="font-semibold text-white truncate">
                                          {item.name}
                                        </div>
                                      )}
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {item.type === 'folder'
                                          ? 'Directory'
                                          : `${item.sizeBytes} bytes • ${item.permissions}`}
                                      </div>
                                    </div>
                                  </div>

                                  {item.isShared && (
                                    <span
                                      className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[9px] flex items-center gap-1 shrink-0"
                                      title="Shared via SMB/FTP"
                                    >
                                      <Share2 className="w-2.5 h-2.5" /> Shared
                                    </span>
                                  )}
                                </div>

                                {item.type === 'file' && item.content && (
                                  <p className="mt-2 text-[11px] text-slate-400 font-mono line-clamp-2 bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                                    {item.content}
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
                                <span className="text-slate-500 truncate">
                                  By {item.authorDeviceName}
                                </span>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenItem(item);
                                    }}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium"
                                  >
                                    {item.type === 'folder' ? 'Open' : 'Edit'}
                                  </button>

                                  {item.type === 'file' && storageMode === 'remote' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTransferFileOverNetwork(item, 'download-to-local');
                                      }}
                                      className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                                      title="Download Copy to Local PC"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {item.type === 'file' &&
                                    storageMode === 'local' &&
                                    connectedRemoteDevice && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTransferFileOverNetwork(item, 'upload-to-remote');
                                        }}
                                        className="p-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300"
                                        title={`Push File to \\\\${connectedRemoteDevice.name}`}
                                      >
                                        <Upload className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                  {storageMode === 'local' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleItemShare(item);
                                      }}
                                      className={`p-1 rounded ${
                                        item.isShared
                                          ? 'text-emerald-400 bg-emerald-500/10'
                                          : 'text-slate-500 hover:text-slate-300'
                                      }`}
                                      title="Toggle Network Sharing"
                                    >
                                      <Share2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingId(item.id);
                                      setRenameText(item.name);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-white"
                                    title="Rename"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteItem(item.id);
                                    }}
                                    className="p-1 rounded text-slate-500 hover:text-rose-400"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Detailed Table View */
                      <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-950 border-b border-slate-800 text-[10px] uppercase text-slate-400">
                              <th className="py-2 px-3">Name</th>
                              <th className="py-2 px-3">Sharing</th>
                              <th className="py-2 px-3">Size</th>
                              <th className="py-2 px-3">Last Author</th>
                              <th className="py-2 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {displayedItems.map((item) => (
                              <tr
                                key={item.id}
                                onDoubleClick={() => handleOpenItem(item)}
                                className="hover:bg-slate-950/60"
                              >
                                <td className="py-2 px-3 font-medium text-white flex items-center gap-2">
                                  {item.type === 'folder' ? (
                                    <Folder className="w-4 h-4 text-amber-400" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-cyan-400" />
                                  )}
                                  <span>{item.name}</span>
                                </td>
                                <td className="py-2 px-3">
                                  {item.isShared ? (
                                    <span className="text-emerald-400 font-mono text-[10px]">
                                      Shared (SMB/FTP)
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 font-mono text-[10px]">
                                      Private
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-400">
                                  {item.type === 'folder' ? '--' : `${item.sizeBytes} B`}
                                </td>
                                <td className="py-2 px-3 text-slate-400">{item.authorDeviceName}</td>
                                <td className="py-2 px-3 text-right space-x-1.5">
                                  <button
                                    onClick={() => handleOpenItem(item)}
                                    className="px-2 py-1 rounded bg-slate-800 text-cyan-300"
                                  >
                                    {item.type === 'folder' ? 'Open' : 'Edit'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="px-2 py-1 rounded bg-slate-800 text-rose-400"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Quick Send-To Peer Bar when viewing Local Files */}
                {storageMode === 'local' && selectedFileId && !editingFile && peerWorkstations.length > 0 && (
                  <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <span className="text-slate-300 font-medium">
                      Quick Send Selected File Over Network ({shareProtocol}):
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {peerWorkstations.map((peer) => {
                        const selItem = localFs.files.find((f) => f.id === selectedFileId);
                        if (!selItem || selItem.type !== 'file') return null;
                        return (
                          <button
                            key={peer.id}
                            onClick={() =>
                              handleTransferFileOverNetwork(selItem, 'upload-to-remote', peer)
                            }
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-300 font-mono text-[11px]"
                          >
                            <Upload className="w-3 h-3" /> Send to {peer.name} (
                            {peer.interfaces[0]?.ipAddress})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            IP CONFIGURATION, BROWSER, DNS, PING & SERVER DAEMONS
           ===================================================================== */}
        {activeApp !== 'files' && (
          <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
            {activeApp === 'ip' && primaryIntf && (
              <div className="space-y-4 max-w-lg">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">IPv4 Addressing Mode</div>
                    <div className="text-[11px] text-slate-400">
                      Choose between manual static configuration or automatic DHCP lease acquisition.
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onUpdateDevice({ ...device, addressingMode: 'static' })}
                      className={`px-3 py-1.5 rounded font-medium ${
                        device.addressingMode !== 'dhcp'
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-300'
                      }`}
                    >
                      Static
                    </button>
                    <button
                      onClick={() => onRequestDhcp(device.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded font-medium ${
                        device.addressingMode === 'dhcp'
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> DHCP
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">IPv4 Address</label>
                    <input
                      type="text"
                      value={primaryIntf.ipAddress}
                      onChange={(e) => {
                        const nextIfs = [...device.interfaces];
                        nextIfs[0] = { ...primaryIntf, ipAddress: e.target.value };
                        onUpdateDevice({ ...device, interfaces: nextIfs });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Subnet Mask</label>
                    <input
                      type="text"
                      value={primaryIntf.subnetMask}
                      onChange={(e) => {
                        const nextIfs = [...device.interfaces];
                        nextIfs[0] = { ...primaryIntf, subnetMask: e.target.value };
                        onUpdateDevice({ ...device, interfaces: nextIfs });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Default Gateway</label>
                    <input
                      type="text"
                      value={device.defaultGateway}
                      onChange={(e) => onUpdateDevice({ ...device, defaultGateway: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">DNS Server</label>
                    <input
                      type="text"
                      value={device.dnsServer}
                      onChange={(e) => onUpdateDevice({ ...device, dnsServer: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeApp === 'browser' && (
              <div className="space-y-3">
                <form onSubmit={handleBrowserGo} className="flex gap-2">
                  <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3">
                    <Globe className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={browserUrl}
                      onChange={(e) => setBrowserUrl(e.target.value)}
                      placeholder="http://192.168.10.10 or http://intranet.netlab.edu"
                      className="w-full py-2 bg-transparent font-mono text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400"
                  >
                    Go
                  </button>
                </form>

                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 min-h-48">
                  {browserResult.status === 'idle' && (
                    <p className="text-slate-400">
                      Enter an HTTP server IP address or domain name above and click <strong>Go</strong> to simulate DNS resolution and TCP Port 80 HTTP transport. (Tip: Edit <code>index.html</code> in the Server&apos;s File Manager to customize the live web page!)
                    </p>
                  )}
                  {browserResult.status === 'ok' && (
                    <div className="space-y-2">
                      <div className="text-emerald-400 font-mono text-[11px] border-b border-slate-800 pb-2">
                        {browserResult.title}
                      </div>
                      <div
                        className="prose prose-invert max-w-none text-slate-200 pt-2"
                        dangerouslySetInnerHTML={{ __html: browserResult.html || '' }}
                      />
                    </div>
                  )}
                  {browserResult.status === 'error' && (
                    <div className="flex items-start gap-2.5 text-rose-400">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">HTTP Connection Failed</div>
                        <p className="text-slate-300 mt-1">{browserResult.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeApp === 'dns' && (
              <div className="space-y-3">
                <form onSubmit={handleDnsLookup} className="flex gap-2">
                  <input
                    type="text"
                    value={dnsQueryHost}
                    onChange={(e) => setDnsQueryHost(e.target.value)}
                    placeholder="Enter domain name (e.g. intranet.netlab.edu)"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold"
                  >
                    Resolve (UDP 53)
                  </button>
                </form>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 min-h-36 whitespace-pre-wrap">
                  {dnsOutput || `Configured DNS Server: ${device.dnsServer || 'None'}\nReady to query A records.`}
                </pre>
              </div>
            )}

            {activeApp === 'ping' && (
              <div className="space-y-3">
                <form onSubmit={handleRunPingDiag} className="flex gap-2">
                  <input
                    type="text"
                    value={pingTarget}
                    onChange={(e) => setPingTarget(e.target.value)}
                    placeholder="Destination IP or hostname..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    Run Trace &amp; Ping
                  </button>
                </form>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 min-h-40 whitespace-pre-wrap">
                  {pingOutput || 'Enter a target IP above to trace every Layer 2 and Layer 3 hop.'}
                </pre>
              </div>
            )}

            {activeApp === 'services' && device.services && (
              <div className="space-y-4">
                {/* HTTP Server Toggle */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">HTTP Web Server (TCP Port 80)</span>
                    <input
                      type="checkbox"
                      checked={device.services.httpEnabled}
                      onChange={(e) =>
                        onUpdateDevice({
                          ...device,
                          services: { ...device.services!, httpEnabled: e.target.checked },
                        })
                      }
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={device.services.httpContent}
                    onChange={(e) =>
                      onUpdateDevice({
                        ...device,
                        services: { ...device.services!, httpContent: e.target.value },
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 font-mono text-[11px] text-slate-200"
                  />
                </div>

                {/* DHCP Server Pool Config */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">DHCP v4 Server (UDP 67/68)</span>
                    <input
                      type="checkbox"
                      checked={device.services.dhcpEnabled}
                      onChange={(e) =>
                        onUpdateDevice({
                          ...device,
                          services: { ...device.services!, dhcpEnabled: e.target.checked },
                        })
                      }
                    />
                  </div>
                  {device.services.dhcpPools[0] && (
                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Start IP:</span>
                        <input
                          type="text"
                          value={device.services.dhcpPools[0].startIp}
                          onChange={(e) => {
                            const pool = { ...device.services!.dhcpPools[0], startIp: e.target.value };
                            onUpdateDevice({
                              ...device,
                              services: { ...device.services!, dhcpPools: [pool] },
                            });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block">Default Gateway Option:</span>
                        <input
                          type="text"
                          value={device.services.dhcpPools[0].defaultRouter}
                          onChange={(e) => {
                            const pool = {
                              ...device.services!.dhcpPools[0],
                              defaultRouter: e.target.value,
                            };
                            onUpdateDevice({
                              ...device,
                              services: { ...device.services!, dhcpPools: [pool] },
                            });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* DNS Records */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">DNS Authoritative Zone (UDP 53)</span>
                    <input
                      type="checkbox"
                      checked={device.services.dnsEnabled}
                      onChange={(e) =>
                        onUpdateDevice({
                          ...device,
                          services: { ...device.services!, dnsEnabled: e.target.checked },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1 font-mono text-[11px]">
                    {device.services.dnsRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between px-2 py-1 rounded bg-slate-900"
                      >
                        <span className="text-cyan-300">{rec.hostname}</span>
                        <span className="text-slate-300">{rec.ipAddress}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newDnsHost}
                      onChange={(e) => setNewDnsHost(e.target.value)}
                      placeholder="hostname.netlab.edu"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono"
                    />
                    <input
                      type="text"
                      value={newDnsIp}
                      onChange={(e) => setNewDnsIp(e.target.value)}
                      placeholder="192.168.10.10"
                      className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono"
                    />
                    <button
                      onClick={() => {
                        if (!newDnsHost.trim() || !newDnsIp.trim()) return;
                        onUpdateDevice({
                          ...device,
                          services: {
                            ...device.services!,
                            dnsRecords: [
                              ...device.services!.dnsRecords,
                              {
                                id: `dns-${Date.now()}`,
                                hostname: newDnsHost.trim(),
                                ipAddress: newDnsIp.trim(),
                                type: 'A',
                              },
                            ],
                          },
                        });
                        setNewDnsHost('');
                        setNewDnsIp('');
                      }}
                      className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 font-semibold"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

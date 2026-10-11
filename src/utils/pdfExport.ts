import { jsPDF } from 'jspdf';
import { NetworkDevice, NetworkLink, NetworkProject } from '../types/network';
import { generateRunningConfigText } from '../engine/cliParser';
import { maskToCidr } from './networkMath';

/**
 * Generates and downloads a multi-page engineering PDF report for a NetworkProject
 * containing:
 * 1. Visual Vector Network Topology Diagram with devices, IP labels, cables, and annotations
 * 2. Complete Device & Interface IPv4/VLAN/MAC Addressing Table
 * 3. Active Cable & Interconnect Matrix
 * 4. Routing Tables & Cisco IOS Running-Configuration Appendix
 */
export function exportTopologyToPdf(project: NetworkProject): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm

  const drawPageHeaderAndFooter = (pageTitle: string, pageNum: number) => {
    // Dark Graphite Top Header Band
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 18, 'F');

    // Cyan Accent Line
    doc.setDrawColor(6, 182, 212); // cyan-500
    doc.setLineWidth(0.6);
    doc.line(0, 18, pageWidth, 18);

    // Header Title & Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('NetLab Simulator — Network Engineering Report', 12, 8);

    doc.setTextColor(34, 211, 238); // cyan-400
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text('MADE BY SHIRO', 12, 14);

    // Right side metadata
    doc.setTextColor(203, 213, 225); // slate-300
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Topology: ${project.name}`, pageWidth - 12, 8, { align: 'right' });
    doc.text(
      `Generated: ${new Date().toLocaleString()} | ${pageTitle}`,
      pageWidth - 12,
      14,
      { align: 'right' }
    );

    // Bottom Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(12, pageHeight - 10, pageWidth - 12, pageHeight - 10);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `NetLab Simulator by SHIRO — ${project.name} (${project.devices.length} Devices, ${project.links.length} Links)`,
      12,
      pageHeight - 5
    );
    doc.text(`Page ${pageNum}`, pageWidth - 12, pageHeight - 5, { align: 'right' });
  };

  // ==========================================================================
  // PAGE 1: VISUAL TOPOLOGY DIAGRAM & SUMMARY
  // ==========================================================================
  let currentPage = 1;
  drawPageHeaderAndFooter('Visual Topology Map', currentPage);

  // Project Overview Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, 22, pageWidth - 24, 14, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(project.name, 16, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const descText =
    project.description || 'Interactive CCNA & Computer Systems Servicing Network Topology.';
  doc.text(descText.slice(0, 135), 16, 33);

  // Legend on right side of summary box
  doc.setFontSize(8);
  doc.setFillColor(16, 185, 129); // Emerald Up
  doc.circle(pageWidth - 88, 27, 1.5, 'F');
  doc.text('Link Up', pageWidth - 84, 28);

  doc.setFillColor(239, 68, 68); // Red Down
  doc.circle(pageWidth - 65, 27, 1.5, 'F');
  doc.text('Link Down', pageWidth - 61, 28);

  doc.setFillColor(56, 189, 248); // Cyan Trunk
  doc.circle(pageWidth - 40, 27, 1.5, 'F');
  doc.text('802.1Q Trunk', pageWidth - 36, 28);

  // Topology Canvas Frame
  const canvasX = 12;
  const canvasY = 40;
  const canvasW = pageWidth - 24; // 273mm
  const canvasH = 152; // 152mm

  // Dark Blueprint Canvas Background for high visual contrast
  doc.setFillColor(15, 23, 42); // slate-900
  doc.setDrawColor(51, 65, 85); // slate-700
  doc.setLineWidth(0.5);
  doc.roundedRect(canvasX, canvasY, canvasW, canvasH, 3, 3, 'FD');

  // Subtle Grid Lines inside Topology Box
  doc.setDrawColor(30, 41, 59); // slate-800
  doc.setLineWidth(0.15);
  for (let gx = canvasX + 10; gx < canvasX + canvasW; gx += 10) {
    doc.line(gx, canvasY, gx, canvasY + canvasH);
  }
  for (let gy = canvasY + 10; gy < canvasY + canvasH; gy += 10) {
    doc.line(canvasX, gy, canvasX + canvasW, gy);
  }

  if (project.devices.length === 0) {
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.text(
      'No devices placed on the topology canvas.',
      canvasX + canvasW / 2,
      canvasY + canvasH / 2,
      { align: 'center' }
    );
  } else {
    // Compute bounding box of devices + annotations to scale cleanly into canvasW x canvasH
    const xs = [
      ...project.devices.map((d) => d.x),
      ...project.annotations.map((a) => a.x),
    ];
    const ys = [
      ...project.devices.map((d) => d.y),
      ...project.annotations.map((a) => a.y),
    ];
    const minX = Math.min(...xs) - 70;
    const maxX = Math.max(...xs) + 120;
    const minY = Math.min(...ys) - 60;
    const maxY = Math.max(...ys) + 95;

    const spanX = Math.max(300, maxX - minX);
    const spanY = Math.max(200, maxY - minY);

    const padX = 18;
    const padY = 16;
    const usableW = canvasW - padX * 2;
    const usableH = canvasH - padY * 2;

    const scale = Math.min(usableW / spanX, usableH / spanY);
    const offsetX = canvasX + padX + (usableW - spanX * scale) / 2;
    const offsetY = canvasY + padY + (usableH - spanY * scale) / 2;

    const mapPt = (x: number, y: number) => ({
      px: offsetX + (x - minX) * scale,
      py: offsetY + (y - minY) * scale,
    });

    // 1. Draw Links (Cables)
    for (const link of project.links) {
      const srcDev = project.devices.find((d) => d.id === link.sourceDeviceId);
      const dstDev = project.devices.find((d) => d.id === link.targetDeviceId);
      if (!srcDev || !dstDev) continue;

      const srcIf = srcDev.interfaces.find((i) => i.id === link.sourceInterfaceId);
      const dstIf = dstDev.interfaces.find((i) => i.id === link.targetInterfaceId);

      // Device center in SVG is (dev.x + 36, dev.y + 28)
      const p1 = mapPt(srcDev.x + 36, srcDev.y + 28);
      const p2 = mapPt(dstDev.x + 36, dstDev.y + 28);

      if (link.status === 'down') {
        doc.setDrawColor(239, 68, 68); // Red
      } else if (link.type === 'trunk') {
        doc.setDrawColor(56, 189, 248); // Cyan
      } else if (link.type === 'serial') {
        doc.setDrawColor(245, 158, 11); // Amber
      } else if (link.type === 'wireless') {
        doc.setDrawColor(96, 165, 250); // Blue
      } else {
        doc.setDrawColor(16, 185, 129); // Emerald
      }

      doc.setLineWidth(link.type === 'trunk' ? 0.8 : 0.55);
      doc.line(p1.px, p1.py, p2.px, p2.py);

      // Port Labels along link (25% and 75%)
      if (srcIf) {
        const lx1 = p1.px + (p2.px - p1.px) * 0.26;
        const ly1 = p1.py + (p2.py - p1.py) * 0.26;
        doc.setFillColor(2, 6, 23);
        doc.roundedRect(lx1 - 5.5, ly1 - 2.2, 11, 4.2, 0.8, 0.8, 'F');
        doc.setTextColor(203, 213, 225);
        doc.setFont('courier', 'bold');
        doc.setFontSize(5.5);
        doc.text(srcIf.shortName, lx1, ly1 + 0.8, { align: 'center' });
      }

      if (dstIf) {
        const lx2 = p1.px + (p2.px - p1.px) * 0.74;
        const ly2 = p1.py + (p2.py - p1.py) * 0.74;
        doc.setFillColor(2, 6, 23);
        doc.roundedRect(lx2 - 5.5, ly2 - 2.2, 11, 4.2, 0.8, 0.8, 'F');
        doc.setTextColor(203, 213, 225);
        doc.setFont('courier', 'bold');
        doc.setFontSize(5.5);
        doc.text(dstIf.shortName, lx2, ly2 + 0.8, { align: 'center' });
      }
    }

    // 2. Draw Annotations
    for (const ann of project.annotations) {
      const pt = mapPt(ann.x, ann.y);
      const boxW = Math.max(24, Math.min(68, ann.text.length * 1.7 + 6));
      doc.setFillColor(30, 41, 59);
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(0.3);
      doc.roundedRect(pt.px, pt.py, boxW, 6.5, 1, 1, 'FD');

      doc.setTextColor(165, 243, 252);
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.5);
      doc.text(ann.text.slice(0, 38), pt.px + 2, pt.py + 4.3);
    }

    // 3. Draw Devices
    for (const dev of project.devices) {
      const center = mapPt(dev.x + 36, dev.y + 28);
      const boxW = 22;
      const boxH = 14;
      const bx = center.px - boxW / 2;
      const by = center.py - boxH / 2;

      const anyUp = dev.interfaces.some((i) => i.adminUp && i.lineProtocolUp);
      const allShut = dev.interfaces.every((i) => !i.adminUp);

      // Node Box
      doc.setFillColor(30, 41, 59); // slate-800
      if (allShut) {
        doc.setDrawColor(239, 68, 68);
      } else if (anyUp) {
        doc.setDrawColor(6, 182, 212);
      } else {
        doc.setDrawColor(100, 116, 139);
      }
      doc.setLineWidth(0.55);
      doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'FD');

      // Status LED dot
      if (allShut) {
        doc.setFillColor(239, 68, 68);
      } else if (anyUp) {
        doc.setFillColor(16, 185, 129);
      } else {
        doc.setFillColor(245, 158, 11);
      }
      doc.circle(bx + boxW - 2.5, by + 2.5, 1.1, 'F');

      // Device Type Badge inside node
      const typeBadge =
        dev.type === 'router'
          ? 'RTR'
          : dev.type === 'l2-switch'
          ? 'SW-L2'
          : dev.type === 'l3-switch'
          ? 'SW-L3'
          : dev.type === 'server'
          ? 'SRV'
          : dev.type === 'firewall'
          ? 'ASA-FW'
          : dev.type === 'wireless-ap'
          ? 'WIFI-AP'
          : dev.type === 'wireless-router'
          ? 'WRT'
          : dev.type === 'wan-cloud'
          ? 'WAN'
          : dev.type.toUpperCase();

      doc.setTextColor(34, 211, 238);
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      doc.text(typeBadge, center.px, center.py - 1, { align: 'center' });

      // Device Name inside node
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(dev.name.slice(0, 12), center.px, center.py + 3.8, { align: 'center' });

      // Primary IP or VLAN tag below node
      const primaryIpIntf = dev.interfaces.find((i) => i.ipAddress);
      if (primaryIpIntf) {
        const cidr = maskToCidr(primaryIpIntf.subnetMask);
        doc.setTextColor(148, 163, 184);
        doc.setFont('courier', 'normal');
        doc.setFontSize(6);
        doc.text(
          `${primaryIpIntf.ipAddress}/${cidr}`,
          center.px,
          by + boxH + 3.5,
          { align: 'center' }
        );
      }
    }
  }

  // ==========================================================================
  // PAGE 2: DEVICE INVENTORY, IP ADDRESSING & CABLING TABLE
  // ==========================================================================
  doc.addPage();
  currentPage++;
  drawPageHeaderAndFooter('Device Inventory & IPv4 / VLAN Configuration Table', currentPage);

  let yPos = 25;

  const ensureSpace = (neededMm: number, sectionTitle: string) => {
    if (yPos + neededMm > pageHeight - 15) {
      doc.addPage();
      currentPage++;
      drawPageHeaderAndFooter(sectionTitle, currentPage);
      yPos = 25;
    }
  };

  // Section 1: Device & Interface Configuration Table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Device & Interface Addressing Table', 12, yPos);
  yPos += 5;

  // Table Header
  const drawInterfaceTableHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(12, yPos, pageWidth - 24, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Device (Hostname)', 14, yPos + 4.8);
    doc.text('Model / Role', 54, yPos + 4.8);
    doc.text('Interface', 96, yPos + 4.8);
    doc.text('IPv4 Address / Mask', 122, yPos + 4.8);
    doc.text('Default GW / DNS', 168, yPos + 4.8);
    doc.text('Mode / VLAN', 214, yPos + 4.8);
    doc.text('MAC Address', 246, yPos + 4.8);
    doc.text('State', 274, yPos + 4.8);
    yPos += 7;
  };

  drawInterfaceTableHeader();

  let rowIdx = 0;
  for (const dev of project.devices) {
    for (let i = 0; i < dev.interfaces.length; i++) {
      const intf = dev.interfaces[i];
      if (yPos + 6.5 > pageHeight - 15) {
        doc.addPage();
        currentPage++;
        drawPageHeaderAndFooter('Device Inventory & IPv4 / VLAN Configuration Table', currentPage);
        yPos = 25;
        drawInterfaceTableHeader();
      }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(241, 245, 249);
      }
      doc.rect(12, yPos, pageWidth - 24, 6, 'F');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.text(
        i === 0 ? `${dev.name} (${dev.hostname})` : '  "',
        14,
        yPos + 4.2
      );

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(i === 0 ? dev.model.slice(0, 24) : '', 54, yPos + 4.2);

      doc.setFont('courier', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(intf.shortName, 96, yPos + 4.2);

      doc.setFont('courier', 'normal');
      const ipDisplay = intf.ipAddress
        ? `${intf.ipAddress} /${maskToCidr(intf.subnetMask)}`
        : 'Unassigned';
      doc.text(ipDisplay, 122, yPos + 4.2);

      const gwDisplay =
        i === 0 && dev.defaultGateway
          ? `GW:${dev.defaultGateway}`
          : i === 0 && dev.ipRoutingEnabled
          ? 'L3 Routing Enabled'
          : '--';
      doc.text(gwDisplay, 168, yPos + 4.2);

      const vlanDisplay =
        intf.switchportMode === 'trunk'
          ? `Trunk (${intf.trunkAllowedVlans.join(',')})`
          : intf.switchportMode === 'access'
          ? `Access VLAN ${intf.accessVlan}`
          : 'Routed (L3)';
      doc.text(vlanDisplay.slice(0, 18), 214, yPos + 4.2);

      doc.text(intf.macAddress, 246, yPos + 4.2);

      const isUp = intf.adminUp && intf.lineProtocolUp;
      if (!intf.adminUp) {
        doc.setTextColor(220, 38, 38);
        doc.text('ADMIN DOWN', 274, yPos + 4.2);
      } else if (isUp) {
        doc.setTextColor(5, 150, 105);
        doc.text('UP / UP', 274, yPos + 4.2);
      } else {
        doc.setTextColor(217, 119, 6);
        doc.text('DOWN', 274, yPos + 4.2);
      }

      yPos += 6;
      rowIdx++;
    }
  }

  yPos += 8;

  // Section 2: Active Cabling & Interconnect Matrix
  ensureSpace(30, 'Cabling & Interconnect Matrix');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`2. Physical & Logical Cabling Matrix (${project.links.length} Connections)`, 12, yPos);
  yPos += 5;

  doc.setFillColor(15, 23, 42);
  doc.rect(12, yPos, pageWidth - 24, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.text('#', 14, yPos + 4.8);
  doc.text('Source Device', 26, yPos + 4.8);
  doc.text('Source Port', 75, yPos + 4.8);
  doc.text('Cable / Media Type', 110, yPos + 4.8);
  doc.text('Target Device', 160, yPos + 4.8);
  doc.text('Target Port', 210, yPos + 4.8);
  doc.text('Link Status', 250, yPos + 4.8);
  yPos += 7;

  project.links.forEach((link, idx) => {
    ensureSpace(7, 'Cabling & Interconnect Matrix');
    const srcDev = project.devices.find((d) => d.id === link.sourceDeviceId);
    const dstDev = project.devices.find((d) => d.id === link.targetDeviceId);
    const srcIf = srcDev?.interfaces.find((i) => i.id === link.sourceInterfaceId);
    const dstIf = dstDev?.interfaces.find((i) => i.id === link.targetInterfaceId);

    doc.setFillColor(idx % 2 === 0 ? 248 : 241, idx % 2 === 0 ? 250 : 245, idx % 2 === 0 ? 252 : 249);
    doc.rect(12, yPos, pageWidth - 24, 6, 'F');

    doc.setTextColor(15, 23, 42);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.text(String(idx + 1), 14, yPos + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.text(srcDev?.name || 'Unknown', 26, yPos + 4.2);
    doc.setFont('courier', 'normal');
    doc.text(srcIf?.name || '-', 75, yPos + 4.2);
    doc.text(link.type.toUpperCase(), 110, yPos + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.text(dstDev?.name || 'Unknown', 160, yPos + 4.2);
    doc.setFont('courier', 'normal');
    doc.text(dstIf?.name || '-', 210, yPos + 4.2);

    if (link.status === 'up') {
      doc.setTextColor(5, 150, 105);
      doc.text('ACTIVE (UP)', 250, yPos + 4.2);
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('DOWN', 250, yPos + 4.2);
    }
    yPos += 6;
  });

  // ==========================================================================
  // PAGE 3+: CISCO IOS RUNNING-CONFIG & ROUTING TABLE APPENDIX
  // ==========================================================================
  const configurableDevices = project.devices.filter(
    (d) =>
      d.type === 'router' ||
      d.type === 'l2-switch' ||
      d.type === 'l3-switch' ||
      d.type === 'firewall' ||
      d.type === 'server'
  );

  if (configurableDevices.length > 0) {
    doc.addPage();
    currentPage++;
    drawPageHeaderAndFooter('Cisco IOS Running-Config & Routing Appendix', currentPage);
    yPos = 25;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('3. Device Configurations, Routing Tables & Shared Services', 12, yPos);
    yPos += 6;

    // Render 2 columns of device configs per page
    let col = 0;
    let colStartY = yPos;
    const colWidth = (pageWidth - 30) / 2; // ~133.5mm

    for (const dev of configurableDevices) {
      const configLines =
        dev.type === 'server'
          ? [
              `Server Hostname: ${dev.hostname}`,
              `IPv4 Address: ${dev.interfaces[0]?.ipAddress || 'Unassigned'} / ${dev.interfaces[0]?.subnetMask || ''}`,
              `Default Gateway: ${dev.defaultGateway || 'None'}`,
              `HTTP Web Server (TCP 80): ${dev.services?.httpEnabled ? 'ENABLED' : 'DISABLED'}`,
              `DHCP Server (UDP 67/68): ${dev.services?.dhcpEnabled ? 'ENABLED' : 'DISABLED'}`,
              `DNS Server (UDP 53): ${dev.services?.dnsEnabled ? 'ENABLED' : 'DISABLED'}`,
              ...(dev.services?.dnsRecords.map((r) => `  DNS A: ${r.hostname} -> ${r.ipAddress}`) || []),
              `SMB File Share (TCP 445): ${dev.fileSystem?.smbSharingEnabled ? 'ENABLED' : 'DISABLED'} (\\\\${dev.name}\\${dev.fileSystem?.shareName || 'Share'})`,
            ]
          : generateRunningConfigText(dev)
              .split('\n')
              .filter((l) => l.trim() !== '!' && !l.startsWith('Building') && !l.startsWith('Current'))
              .slice(0, 28);

      const boxHeight = Math.max(36, configLines.length * 3.6 + 12);

      if (colStartY + boxHeight > pageHeight - 15) {
        if (col === 0) {
          col = 1;
          colStartY = 31;
        } else {
          doc.addPage();
          currentPage++;
          drawPageHeaderAndFooter('Cisco IOS Running-Config & Routing Appendix', currentPage);
          col = 0;
          colStartY = 25;
        }
      }

      const xLeft = col === 0 ? 12 : 12 + colWidth + 6;

      // Config Card Box
      doc.setFillColor(15, 23, 42);
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(xLeft, colStartY, colWidth, boxHeight, 2, 2, 'FD');

      // Card Header
      doc.setTextColor(34, 211, 238);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`${dev.name} (${dev.model}) — Configuration`, xLeft + 4, colStartY + 6);

      // Config Lines
      doc.setTextColor(226, 232, 240);
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.8);

      let lineY = colStartY + 11;
      for (const line of configLines) {
        doc.text(line.slice(0, 72), xLeft + 4, lineY);
        lineY += 3.5;
      }

      if (col === 0) {
        col = 1;
      } else {
        col = 0;
        colStartY += boxHeight + 6;
      }
    }
  }

  const safeFilename =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'netlab-topology';

  doc.save(`${safeFilename}-report.pdf`);
}

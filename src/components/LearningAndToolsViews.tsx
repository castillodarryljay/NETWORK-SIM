import React, { useState } from 'react';
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Bookmark,
  Search,
  Play,
  ArrowRight,
  Layers,
  Terminal,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import {
  COMMAND_REFERENCE,
  LEARNING_LESSONS,
  LearningLesson,
} from '../data/learningContent';
import {
  GUIDED_LABS,
  TROUBLESHOOTING_CHALLENGES,
} from '../data/labsAndChallenges';
import {
  DEVICE_CATALOG,
  calculateSubnetDetails,
} from '../utils/networkMath';
import { NetworkProject } from '../types/network';
import { StudentProgressState } from '../store/persistence';

interface LearningAndToolsViewsProps {
  mode: 'learning' | 'labs' | 'challenges' | 'reference' | 'subnet-calc';
  currentProject: NetworkProject;
  progress: StudentProgressState;
  selectedLessonId: string | null;
  onSelectLesson: (id: string) => void;
  onMarkLessonComplete: (id: string) => void;
  onToggleBookmarkLesson: (id: string) => void;
  onLaunchGuidedLab: (labId: string) => void;
  onMarkLabComplete: (labId: string) => void;
  onLaunchChallenge: (challengeId: string) => void;
  onMarkChallengeComplete: (challengeId: string) => void;
  onIncrementSubnetCalc: () => void;
}

const OSI_LAYERS_DATA = [
  {
    layer: 7,
    name: 'Application',
    pdu: 'Data / Payload',
    protocols: 'HTTP, DNS, DHCP, SSH, FTP',
    function: 'Provides network services directly to user applications (web browsers, email, domain lookup).',
    fields: 'HTTP Request Method (GET /index.html), DNS Query Name, DHCP Options',
  },
  {
    layer: 6,
    name: 'Presentation',
    pdu: 'Data',
    protocols: 'TLS/SSL, UTF-8, JSON, JPEG',
    function: 'Handles data formatting, character encoding, compression, and TLS encryption/decryption.',
    fields: 'Content-Type, Character Encoding, TLS Cipher Suite',
  },
  {
    layer: 5,
    name: 'Session',
    pdu: 'Data',
    protocols: 'NetBIOS, RPC, Sockets',
    function: 'Establishes, manages, and terminates logical dialogues between application processes.',
    fields: 'Session ID, Dialog Control Tokens',
  },
  {
    layer: 4,
    name: 'Transport',
    pdu: 'Segment (TCP) / Datagram (UDP)',
    protocols: 'TCP (Reliable), UDP (Connectionless)',
    function: 'Provides end-to-end host process multiplexing via port numbers, sequencing, and flow control.',
    fields: 'Source Port (e.g., 49152), Destination Port (80 HTTP, 53 DNS), Sequence/ACK Numbers',
  },
  {
    layer: 3,
    name: 'Network',
    pdu: 'Packet',
    protocols: 'IPv4, IPv6, ICMP, OSPF, RIP',
    function: 'Logical end-to-end addressing and Longest-Prefix Match routing across multiple networks.',
    fields: 'Source IP, Destination IP, TTL (Time-To-Live), Protocol Number (1=ICMP, 6=TCP, 17=UDP)',
  },
  {
    layer: 2,
    name: 'Data Link',
    pdu: 'Frame',
    protocols: 'Ethernet (802.3), VLAN Trunking (802.1Q), Wi-Fi (802.11), ARP',
    function: 'Hop-to-hop frame delivery across a single physical link or VLAN broadcast domain via MAC addresses.',
    fields: 'Destination MAC (48-bit), Source MAC (48-bit), 802.1Q VLAN Tag, EtherType, FCS CRC',
  },
  {
    layer: 1,
    name: 'Physical',
    pdu: 'Bits / Symbols',
    protocols: '1000BASE-T Copper, SFP Fiber, Serial V.35',
    function: 'Transmits raw electrical, optical, or radio signals across physical media.',
    fields: 'Preamble, Start Frame Delimiter (SFD), Line Coding & Clocking',
  },
];

export const LearningAndToolsViews: React.FC<LearningAndToolsViewsProps> = ({
  mode,
  currentProject,
  progress,
  selectedLessonId,
  onSelectLesson,
  onMarkLessonComplete,
  onToggleBookmarkLesson,
  onLaunchGuidedLab,
  onMarkLabComplete,
  onLaunchChallenge,
  onMarkChallengeComplete,
  onIncrementSubnetCalc,
}) => {
  // Learning Center states
  const [lessonSearch, setLessonSearch] = useState('');
  const [lessonTab, setLessonTab] = useState<'lessons' | 'interactive-tools' | 'commands'>('lessons');
  const [selectedOsiLayer, setSelectedOsiLayer] = useState<number>(3);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  // Encapsulation demo state
  const [encapPayload, setEncapPayload] = useState('GET /portal.html');
  const [encapProto, setEncapProto] = useState<'HTTP' | 'DNS' | 'ICMP'>('HTTP');

  // Subnet calculator states
  const [calcIp, setCalcIp] = useState('192.168.10.25');
  const [calcMask, setCalcMask] = useState('/26');
  const [practiceIp, setPracticeIp] = useState('10.20.30.100');
  const [practiceCidr, setPracticeCidr] = useState('/26');
  const [studentNetGuess, setStudentNetGuess] = useState('');
  const [studentBcastGuess, setStudentBcastGuess] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null);

  // Reference filter
  const [cmdSearch, setCmdSearch] = useState('');

  // Challenge hints state
  const [shownHintIds, setShownHintIds] = useState<Record<string, boolean>>({});

  // ==========================================================================
  // 1. LEARNING CENTER (LESSONS, INTERACTIVE EXPLORERS & COMMAND REFERENCE)
  // ==========================================================================
  if (mode === 'learning') {
    const activeLesson: LearningLesson =
      LEARNING_LESSONS.find((l) => l.id === selectedLessonId) || LEARNING_LESSONS[0];

    const filteredLessons = LEARNING_LESSONS.filter(
      (l) =>
        !lessonSearch.trim() ||
        l.title.toLowerCase().includes(lessonSearch.toLowerCase()) ||
        l.pathCategory.toLowerCase().includes(lessonSearch.toLowerCase())
    );

    const filteredCommands = COMMAND_REFERENCE.filter(
      (c) =>
        !cmdSearch.trim() ||
        c.command.toLowerCase().includes(cmdSearch.toLowerCase()) ||
        c.description.toLowerCase().includes(cmdSearch.toLowerCase())
    );

    const activeOsiObj = OSI_LAYERS_DATA.find((o) => o.layer === selectedOsiLayer) || OSI_LAYERS_DATA[4];

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100">
        {/* Sub-navigation bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setLessonTab('lessons')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                lessonTab === 'lessons'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Structured Lessons ({LEARNING_LESSONS.length})
            </button>
            <button
              onClick={() => setLessonTab('interactive-tools')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                lessonTab === 'interactive-tools'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              OSI & Packet Encapsulation Visualizers
            </button>
            <button
              onClick={() => setLessonTab('commands')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                lessonTab === 'commands'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              CLI Command Reference ({COMMAND_REFERENCE.length})
            </button>
          </div>

          <div className="text-xs text-slate-400 tabular-nums">
            Completed: {progress.completedLessonIds.length} / {LEARNING_LESSONS.length} Lessons
          </div>
        </div>

        {lessonTab === 'lessons' && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Lesson Curriculum List */}
            <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0 max-h-64 lg:max-h-none">
              <div className="p-3 border-b border-slate-800">
                <input
                  type="search"
                  value={lessonSearch}
                  onChange={(e) => setLessonSearch(e.target.value)}
                  placeholder="Search lessons, VLANs, OSPF..."
                  className="w-full px-3 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                {filteredLessons.map((les) => {
                  const isCompleted = progress.completedLessonIds.includes(les.id);
                  const isCurrent = activeLesson.id === les.id;
                  return (
                    <button
                      key={les.id}
                      onClick={() => onSelectLesson(les.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                        <span>
                          {les.level} · {les.durationMinutes} min
                        </span>
                        {isCompleted && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs font-semibold leading-snug">{les.title}</div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Lesson Reader & Knowledge Check */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <div className="text-xs font-medium text-cyan-400">
                      {activeLesson.pathCategory} · {activeLesson.level} · {activeLesson.durationMinutes} min read
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                      {activeLesson.title}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleBookmarkLesson(activeLesson.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1 ${
                        progress.bookmarkedLessonIds.includes(activeLesson.id)
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      {progress.bookmarkedLessonIds.includes(activeLesson.id) ? 'Saved' : 'Bookmark'}
                    </button>
                    <button
                      onClick={() => onMarkLessonComplete(activeLesson.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                        progress.completedLessonIds.includes(activeLesson.id)
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {progress.completedLessonIds.includes(activeLesson.id)
                        ? 'Completed'
                        : 'Mark Complete'}
                    </button>
                  </div>
                </div>

                {/* Learning Objectives */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <h2 className="text-xs font-bold text-cyan-300">Learning Objectives</h2>
                  <ul className="space-y-1 text-xs text-slate-200 list-disc list-inside">
                    {activeLesson.objectives.map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>

                {/* Core Explanation */}
                <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
                  {activeLesson.explanation.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>

                {/* Key Terminology */}
                <div className="space-y-2.5">
                  <h2 className="text-sm font-bold text-white">Key Networking Terminology</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeLesson.keyTerminology.map((kt) => (
                      <div
                        key={kt.term}
                        className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/50 text-xs"
                      >
                        <div className="font-bold text-cyan-300">{kt.term}</div>
                        <p className="text-slate-300 mt-1 leading-relaxed">{kt.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Practical CLI Example */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 space-y-3 text-xs">
                  <div className="font-bold text-white text-sm">
                    Practical Configuration: {activeLesson.practicalExample.title}
                  </div>
                  <p className="text-slate-300">{activeLesson.practicalExample.scenario}</p>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-cyan-300 overflow-x-auto">
                    {activeLesson.practicalExample.commands.join('\n')}
                  </pre>
                  <div className="text-slate-300">
                    <strong className="text-slate-100">Why this is used: </strong>
                    {activeLesson.practicalExample.whyUsed}
                  </div>
                  <div className="text-emerald-300">
                    <strong>How to verify: </strong>
                    {activeLesson.practicalExample.verification}
                  </div>
                </div>

                {/* Common Mistakes */}
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
                  <div className="font-bold text-amber-300">Common Student Pitfalls to Avoid</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {activeLesson.commonMistakes.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>

                {/* Interactive Knowledge Check Quiz */}
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
                  <h2 className="text-sm font-bold text-white">Interactive Knowledge Check</h2>
                  {activeLesson.quiz.map((q, qIdx) => {
                    const key = `${activeLesson.id}-${qIdx}`;
                    const chosen = quizAnswers[key];
                    const isCorrect = chosen === q.correctIndex;
                    return (
                      <div key={key} className="space-y-2.5 text-xs">
                        <div className="font-semibold text-slate-100">
                          {qIdx + 1}. {q.question}
                        </div>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              onClick={() => setQuizAnswers({ ...quizAnswers, [key]: oIdx })}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                                chosen === oIdx
                                  ? oIdx === q.correctIndex
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-semibold'
                                    : 'bg-rose-500/20 border-rose-500 text-rose-200'
                                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        {chosen !== undefined && (
                          <div
                            className={`p-3 rounded-lg ${
                              isCorrect
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : 'bg-rose-500/10 text-rose-300'
                            }`}
                          >
                            <strong>{isCorrect ? 'Correct! ' : 'Try Again: '}</strong>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {activeLesson.relatedLabId && (
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        Ready to practice this topic in a live network topology?
                      </span>
                      <button
                        onClick={() => onLaunchGuidedLab(activeLesson.relatedLabId!)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        Launch Related Guided Lab <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {lessonTab === 'interactive-tools' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="max-w-5xl mx-auto space-y-8">
              {/* Interactive OSI 7-Layer Explorer */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Interactive OSI 7-Layer Model Explorer
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click any OSI layer below to inspect its PDU, protocols, header fields, and role in packet delivery.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-5 space-y-1.5">
                    {OSI_LAYERS_DATA.map((item) => (
                      <button
                        key={item.layer}
                        onClick={() => setSelectedOsiLayer(item.layer)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                          selectedOsiLayer === item.layer
                            ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                            : 'bg-slate-950 border-slate-800 text-slate-200 hover:bg-slate-900'
                        }`}
                      >
                        <span>
                          Layer {item.layer} — {item.name}
                        </span>
                        <span className="font-mono text-[11px] opacity-80">{item.pdu}</span>
                      </button>
                    ))}
                  </div>

                  <div className="md:col-span-7 p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                    <div className="text-cyan-400 font-mono font-bold">
                      OSI LAYER {activeOsiObj.layer} · PDU: {activeOsiObj.pdu.toUpperCase()}
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {activeOsiObj.name} Layer Responsibilities
                    </h3>
                    <p className="text-slate-300 leading-relaxed">{activeOsiObj.function}</p>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                      <div>
                        <strong className="text-slate-200">Standard Protocols: </strong>
                        <span className="font-mono text-cyan-300">{activeOsiObj.protocols}</span>
                      </div>
                      <div>
                        <strong className="text-slate-200">Relevant Header Fields: </strong>
                        <span className="font-mono text-slate-300">{activeOsiObj.fields}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Packet Encapsulation Visualizer */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Live Packet Encapsulation & Header Builder
                  </h2>
                  <p className="text-xs text-slate-400">
                    Customize an application payload and protocol below to see how headers wrap the PDU at Layers 4, 3, and 2. Notice that ICMP carries no Layer 4 TCP/UDP port header.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Protocol:</span>
                    {(['HTTP', 'DNS', 'ICMP'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setEncapProto(p)}
                        className={`px-3 py-1 rounded font-mono ${
                          encapProto === p
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-950 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 min-w-52">
                    <input
                      type="text"
                      value={encapPayload}
                      onChange={(e) => setEncapPayload(e.target.value)}
                      placeholder="Application Data / Payload..."
                      className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 font-mono text-white"
                    />
                  </div>
                </div>

                {/* Visual Nested Encapsulation Frame */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs flex flex-wrap items-stretch gap-2">
                  <div className="p-3 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300">
                    <div className="text-[10px] uppercase font-bold">L2 Ethernet Header</div>
                    <div className="mt-1">Dst MAC: 00:50:79:00:00:66</div>
                    <div>Src MAC: 00:50:79:00:00:65</div>
                    <div>Type: 0x0800 (IPv4)</div>
                  </div>

                  <div className="p-3 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
                    <div className="text-[10px] uppercase font-bold">L3 IPv4 Header</div>
                    <div className="mt-1">Src IP: 192.168.10.10</div>
                    <div>Dst IP: 192.168.10.20</div>
                    <div>
                      Proto: {encapProto === 'HTTP' ? '6 (TCP)' : encapProto === 'DNS' ? '17 (UDP)' : '1 (ICMP)'} · TTL: 64
                    </div>
                  </div>

                  {encapProto !== 'ICMP' ? (
                    <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300">
                      <div className="text-[10px] uppercase font-bold">
                        L4 {encapProto === 'HTTP' ? 'TCP Segment' : 'UDP Datagram'}
                      </div>
                      <div className="mt-1">Src Port: 49152</div>
                      <div>Dst Port: {encapProto === 'HTTP' ? '80 (HTTP)' : '53 (DNS)'}</div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                      <div className="text-[10px] uppercase font-bold">L3 ICMP Header (No L4 Ports)</div>
                      <div className="mt-1">Type: 8 (Echo Request)</div>
                      <div>Code: 0 · Checksum: 0x4d5a</div>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 flex-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Payload Data</div>
                    <div className="mt-1 break-all">{encapPayload}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300">
                    <div className="text-[10px] uppercase font-bold">L2 Trailer</div>
                    <div className="mt-1">FCS CRC-32</div>
                    <div>0x9A8B7C6D</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {lessonTab === 'commands' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Supported Cisco IOS & Workstation CLI Command Reference
                  </h2>
                  <p className="text-xs text-slate-400">
                    Every command below is implemented in the NetLab Simulator CLI parser and updates live device state.
                  </p>
                </div>
                <input
                  type="search"
                  value={cmdSearch}
                  onChange={(e) => setCmdSearch(e.target.value)}
                  placeholder="Filter commands (e.g. switchport, route)..."
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white w-full sm:w-64"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCommands.map((cmd) => (
                  <div
                    key={cmd.command}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-cyan-300 text-sm">
                        {cmd.command}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{cmd.mode}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Syntax: <code className="text-slate-200">{cmd.syntax}</code>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{cmd.description}</p>
                    <pre className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                      {cmd.example}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // 2. GUIDED LABS CATALOG & LIVE VALIDATOR VIEW
  // ==========================================================================
  if (mode === 'labs') {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-bold text-white">
              Guided Networking Labs with Live State Validation
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Launch any lab to load its starter topology in the simulator, configure the devices, and run live objective validation against real interface, routing, VLAN, and ping state.
            </p>
          </div>

          <div className="space-y-4">
            {GUIDED_LABS.map((lab) => {
              const isActiveLab = currentProject.labId === lab.id;
              const isCompleted = progress.completedLabIds.includes(lab.id);
              const results = lab.objectives.map((obj) => ({
                obj,
                res: obj.check(currentProject),
              }));
              const allPassed = results.every((r) => r.res.passed);

              return (
                <div
                  key={lab.id}
                  className={`p-5 rounded-xl border ${
                    isActiveLab
                      ? 'border-cyan-500/60 bg-slate-900/90'
                      : 'border-slate-800 bg-slate-900/50'
                  } space-y-4`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-cyan-400">
                        {lab.category} · {lab.difficulty} · {lab.estimatedMinutes} min
                        {isCompleted ? ' · COMPLETED' : ''}
                      </div>
                      <h2 className="text-base font-bold text-white mt-0.5">{lab.title}</h2>
                      <p className="text-xs text-slate-300 mt-1">{lab.scenario}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onLaunchGuidedLab(lab.id)}
                        className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 whitespace-nowrap"
                      >
                        {isActiveLab ? 'Reset & Reload Lab in Simulator' : 'Load Lab in Simulator'}
                      </button>
                    </div>
                  </div>

                  {/* Step Instructions */}
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                    <div className="font-semibold text-slate-200">Lab Instructions:</div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300">
                      {lab.instructions.map((inst, i) => (
                        <li key={i}>{inst}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Live Validation Objectives (Evaluated against currentProject when active) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">
                        Live Objective Verification {isActiveLab ? '(Active Workspace)' : '(Load lab to verify)'}
                      </span>
                      {isActiveLab && allPassed && !isCompleted && (
                        <button
                          onClick={() => onMarkLabComplete(lab.id)}
                          className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold"
                        >
                          Record Lab Completion
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {results.map(({ obj, res }) => (
                        <div
                          key={obj.id}
                          className={`p-3 rounded-lg border text-xs ${
                            isActiveLab && res.passed
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                              : 'bg-slate-950 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">{obj.description}</span>
                            {isActiveLab && res.passed && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          {isActiveLab && (
                            <p className="text-[11px] text-slate-400">{res.feedback}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 3. PRACTICE CHALLENGES & TROUBLESHOOTING MODE
  // ==========================================================================
  if (mode === 'challenges') {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-bold text-white">
              Troubleshooting Challenges & Diagnostic Scenarios
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Investigate deliberately broken networks using CLI inspection commands and packet tracing. Challenges never alter your saved projects without consent.
            </p>
          </div>

          <div className="space-y-4">
            {TROUBLESHOOTING_CHALLENGES.map((chal) => {
              const isActive = currentProject.challengeId === chal.id;
              const checkRes = isActive
                ? chal.verifySolved(currentProject)
                : { solved: false, details: 'Load challenge in simulator to test fix.' };

              return (
                <div
                  key={chal.id}
                  className={`p-5 rounded-xl border ${
                    isActive
                      ? 'border-amber-500/60 bg-slate-900/90'
                      : 'border-slate-800 bg-slate-900/50'
                  } space-y-4 text-xs`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-amber-400 font-medium">
                        Troubleshooting Challenge · {chal.difficulty}
                      </div>
                      <h2 className="text-base font-bold text-white mt-0.5">{chal.title}</h2>
                      <p className="text-slate-300 mt-1">
                        <strong>Reported Symptom: </strong>
                        {chal.symptom}
                      </p>
                      <p className="text-cyan-300 mt-1">
                        <strong>Goal: </strong>
                        {chal.goal}
                      </p>
                    </div>
                    <button
                      onClick={() => onLaunchChallenge(chal.id)}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 whitespace-nowrap shrink-0"
                    >
                      {isActive ? 'Reset Challenge State' : 'Launch Challenge Network'}
                    </button>
                  </div>

                  {/* Diagnostic Assistant Suggestions */}
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-slate-200">
                        Diagnostic Assistant Suggested CLI Commands:{' '}
                      </span>
                      <span className="font-mono text-cyan-300">
                        {chal.diagnosticCommandsSuggested.join(' · ')}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setShownHintIds({ ...shownHintIds, [chal.id]: !shownHintIds[chal.id] })
                      }
                      className="text-amber-300 hover:underline font-medium"
                    >
                      {shownHintIds[chal.id] ? 'Hide Hints' : 'Reveal Optional Hints'}
                    </button>
                  </div>

                  {shownHintIds[chal.id] && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                      {chal.hints.map((h, i) => (
                        <div key={i}>• {h}</div>
                      ))}
                    </div>
                  )}

                  {isActive && (
                    <div
                      className={`p-4 rounded-lg border ${
                        checkRes.solved
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      } space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Live Challenge Status: {checkRes.details}</span>
                        {checkRes.solved && !progress.completedChallengeIds.includes(chal.id) && (
                          <button
                            onClick={() => onMarkChallengeComplete(chal.id)}
                            className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold"
                          >
                            Save Challenge Victory
                          </button>
                        )}
                      </div>

                      {checkRes.solved && (
                        <div className="pt-2 border-t border-emerald-500/30 space-y-1 text-[11px]">
                          <div>
                            <strong>Root Cause: </strong>
                            {chal.postMortemExplanation.whatWasWrong}
                          </div>
                          <div>
                            <strong>How Identified: </strong>
                            {chal.postMortemExplanation.howIdentified}
                          </div>
                          <div>
                            <strong>Key Takeaway: </strong>
                            {chal.postMortemExplanation.keyTakeaway}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 4. DEVICE HARDWARE & CAPABILITY REFERENCE VIEW
  // ==========================================================================
  if (mode === 'reference') {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-bold text-white">
              Hardware Device Reference & Capability Matrix
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Detailed specifications, default interfaces, supported simulation protocols, and documented boundaries for all 11 device models.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEVICE_CATALOG.map((dev) => (
              <div
                key={dev.type}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">{dev.model}</h2>
                  <span className="font-mono text-[11px] text-cyan-400 uppercase">{dev.type}</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{dev.description}</p>
                <div className="text-[11px] font-mono text-slate-400">
                  Interfaces: {dev.interfaceSummary}
                </div>
                <div>
                  <span className="text-emerald-400 font-semibold">Supported Simulation Features: </span>
                  <span className="text-slate-300">{dev.capabilities.join(' · ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Out of Scope / Not Emulated: </span>
                  <span className="text-slate-500">{dev.unsupportedFeatures.join(' · ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 5. INTERACTIVE SUBNET CALCULATOR & STEP-BY-STEP BINARY TUTOR
  // ==========================================================================
  const calcResult = calculateSubnetDetails(calcIp, calcMask);
  const practiceTarget = calculateSubnetDetails(practiceIp, practiceCidr);

  const handleCheckPractice = (e: React.FormEvent) => {
    e.preventDefault();
    onIncrementSubnetCalc();
    if (
      studentNetGuess.trim() === practiceTarget.networkAddress &&
      studentBcastGuess.trim() === practiceTarget.broadcastAddress
    ) {
      setPracticeFeedback(
        `Correct! For ${practiceIp}${practiceCidr}, the Network Address is ${practiceTarget.networkAddress} and the Broadcast Address is ${practiceTarget.broadcastAddress} (${practiceTarget.usableHosts} usable hosts).`
      );
    } else {
      setPracticeFeedback(
        `Not quite. Expected Network Address ${practiceTarget.networkAddress} and Broadcast Address ${practiceTarget.broadcastAddress}. Check the block size (256 - ${
          practiceTarget.subnetMask.split('.')[3]
        }) and retry!`
      );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-white">
            IPv4 Subnet Calculator, Binary Visualizer & Subnetting Tutor
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enter any IPv4 address and CIDR prefix (/1–/32) or dotted-decimal subnet mask to compute network ranges and inspect bitwise AND operations.
          </p>
        </div>

        {/* Calculator Input & Output Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white">Input IPv4 & Prefix / Mask</h2>
            <div>
              <label className="block text-slate-400 mb-1">IPv4 Address</label>
              <input
                type="text"
                value={calcIp}
                onChange={(e) => {
                  setCalcIp(e.target.value);
                  onIncrementSubnetCalc();
                }}
                placeholder="192.168.10.25"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">
                CIDR Prefix (e.g. /24, /26) or Subnet Mask (e.g. 255.255.255.192)
              </label>
              <input
                type="text"
                value={calcMask}
                onChange={(e) => {
                  setCalcMask(e.target.value);
                  onIncrementSubnetCalc();
                }}
                placeholder="/24 or 255.255.255.0"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['/24', '/25', '/26', '/27', '/28', '/30'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setCalcMask(preset)}
                  className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 font-mono text-cyan-300"
                >
                  {preset}
                </button>
              ))}
            </div>

            {!calcResult.valid && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300">
                {calcResult.error}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white">Calculated Subnet Parameters</h2>
            {calcResult.valid && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono tabular-nums">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-sans">Network Address</div>
                    <div className="text-sm font-bold text-cyan-300 mt-0.5">
                      {calcResult.networkAddress}/{calcResult.cidr}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-sans">Broadcast Address</div>
                    <div className="text-sm font-bold text-amber-300 mt-0.5">
                      {calcResult.broadcastAddress}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-sans">Usable Host Count</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">
                      {calcResult.usableHosts.toLocaleString()} hosts
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-sans">First Usable Host</div>
                    <div className="text-slate-100 mt-0.5">{calcResult.firstUsableHost}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-sans">Last Usable Host</div>
                    <div className="text-slate-100 mt-0.5">{calcResult.lastUsableHost}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-sans">Subnet / Wildcard</div>
                    <div className="text-slate-200 mt-0.5">
                      {calcResult.subnetMask} ({calcResult.wildcardMask})
                    </div>
                  </div>
                </div>

                {/* 32-Bit Binary Bitwise Visualizer */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1.5 overflow-x-auto">
                  <div className="text-slate-400 font-sans font-semibold mb-1">
                    Bitwise AND Calculation (32-Bit Binary Breakdown):
                  </div>
                  <div>
                    <span className="text-slate-400 inline-block w-28">IPv4 Binary:</span>
                    <span className="text-slate-200">{calcResult.binaryIp}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 inline-block w-28">Subnet Mask:</span>
                    <span className="text-cyan-400">{calcResult.binaryMask}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-1">
                    <span className="text-slate-400 inline-block w-28">Network ID:</span>
                    <span className="text-emerald-400 font-bold">{calcResult.binaryNetwork}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Interactive Subnetting Practice Tutor */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Interactive Subnetting Practice Drill
              </h2>
              <p className="text-slate-400">
                Calculate the Network Address and Broadcast Address for{' '}
                <code className="text-cyan-300 font-bold">
                  {practiceIp}
                  {practiceCidr}
                </code>{' '}
                and check your answer.
              </p>
            </div>
            <button
              onClick={() => {
                const cidrs = ['/24', '/25', '/26', '/27', '/28', '/30'];
                const randomCidr = cidrs[Math.floor(Math.random() * cidrs.length)];
                const randomHost = Math.floor(Math.random() * 240) + 10;
                setPracticeIp(`192.168.50.${randomHost}`);
                setPracticeCidr(randomCidr);
                setStudentNetGuess('');
                setStudentBcastGuess('');
                setPracticeFeedback(null);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> New Random Subnet Question
            </button>
          </div>

          <form onSubmit={handleCheckPractice} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-slate-400 mb-1">Your Network Address</label>
              <input
                type="text"
                value={studentNetGuess}
                onChange={(e) => setStudentNetGuess(e.target.value)}
                placeholder="e.g. 10.20.30.64"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Your Broadcast Address</label>
              <input
                type="text"
                value={studentBcastGuess}
                onChange={(e) => setStudentBcastGuess(e.target.value)}
                placeholder="e.g. 10.20.30.127"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-white"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400"
            >
              Verify Answer
            </button>
          </form>

          {practiceFeedback && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300">
              {practiceFeedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

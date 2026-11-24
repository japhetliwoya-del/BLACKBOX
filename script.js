/* BLACKBOX v2.0 - local browser simulation. No real OS/file access. */
"use strict";

const KEYS = {
  history: "blackbox_v2_history",
  events: "blackbox_v2_events",
  role: "blackbox_v2_role",
  filesystem: "blackbox_v2_filesystem",
  settings: "blackbox_v2_settings"
};

const DEFAULT_FS = {
  root: {
    type: "folder",
    children: {
      "readme.txt": {
        type: "file",
        content: "Welcome to BLACKBOX v2.0.\\nThis is a virtual file stored in your browser.\\nTry: cat readme.txt"
      },
      projects: { type: "folder", children: {} },
      documents: { type: "folder", children: {} }
    }
  }
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

let commandHistory = loadJSON(KEYS.history, []);
let historyIndex = commandHistory.length;
let eventLog = loadJSON(KEYS.events, []);
let currentRole = localStorage.getItem(KEYS.role) || "developer";
let fileSystem = loadJSON(KEYS.filesystem, DEFAULT_FS);
let settings = loadJSON(KEYS.settings, { scanLevel: "standard", lastScan: null });
let currentDirectory = ["root"];
const startedAt = Date.now();

const $ = id => document.getElementById(id);
const input = $("command");
const output = $("output");

function persist() {
  try {
    localStorage.setItem(KEYS.history, JSON.stringify(commandHistory));
    localStorage.setItem(KEYS.events, JSON.stringify(eventLog));
    localStorage.setItem(KEYS.role, currentRole);
    localStorage.setItem(KEYS.filesystem, JSON.stringify(fileSystem));
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  } catch (error) {
    print("Storage error: browser storage may be full or unavailable.", "error");
  }
}

function print(message, kind = "") {
  const p = document.createElement("p");
  if (kind) p.className = "out-" + kind;
  p.textContent = String(message);
  output.appendChild(p);
  output.scrollTop = output.scrollHeight;
}

function printPrompt(command) {
  const p = document.createElement("p");
  p.className = "out-prompt";
  p.textContent = `root@blackbox:${getPath()}$ ${command}`;
  output.appendChild(p);
}

function logEvent(message) {
  const time = new Date().toLocaleTimeString();
  eventLog.push(`[${time}] ${message}`);
  if (eventLog.length > 60) eventLog = eventLog.slice(-60);
  localStorage.setItem(KEYS.events, JSON.stringify(eventLog));
  renderEvents();
}

function getFolder(parts = currentDirectory) {
  // Start at the actual virtual root folder, not the outer fileSystem wrapper.
  let node = fileSystem.root;
  for (const part of parts.slice(1)) {
    if (!node.children || !Object.prototype.hasOwnProperty.call(node.children, part)) return null;
    node = node.children[part];
    if (node.type !== "folder") return null;
  }
  return node;
}

function getPath() {
  return currentDirectory.length === 1 ? "~" : "~/" + currentDirectory.slice(1).join("/");
}

function resolvePath(path) {
  if (!path || path === "." || path === "~" || path === "/") return getFolder();

  const absolute = path.startsWith("/");
  let cleanPath = path;

  // Accept both /folder/file and the displayed /root/folder/file form.
  if (cleanPath.startsWith("/root/")) cleanPath = cleanPath.slice(6);
  else if (cleanPath === "/root") cleanPath = "";

  const parts = (absolute ? [] : currentDirectory.slice(1))
    .concat(cleanPath.replace(/^\/+/, "").split("/").filter(Boolean));

  // Normalize "." and ".." without allowing navigation above the virtual root.
  const normalized = [];
  for (const part of parts) {
    if (part === "." || part === "~" || part === "") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }

  let node = fileSystem.root;
  for (const part of normalized) {
    if (!node.children || !Object.prototype.hasOwnProperty.call(node.children, part)) return null;
    node = node.children[part];
  }
  return node;
}

function resolveParent(path) {
  const clean = path.trim().replace(/\/+$/, "");
  const idx = clean.lastIndexOf("/");
  const name = idx >= 0 ? clean.slice(idx + 1) : clean;
  const parentPath = idx >= 0 ? clean.slice(0, idx) : "";
  const parent = parentPath ? resolvePath(parentPath) : getFolder();
  return { parent, name };
}

function tokenize(line) {
  const tokens = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = regex.exec(line)) !== null) tokens.push(match[1] ?? match[2] ?? match[3]);
  return tokens;
}

function parseCommand(raw) {
  const trimmed = raw.trim();
  const space = trimmed.search(/\s/);
  if (space === -1) return { name: trimmed.toLowerCase(), args: "", rawArgs: "" };
  return {
    name: trimmed.slice(0, space).toLowerCase(),
    args: trimmed.slice(space + 1).trim(),
    rawArgs: trimmed.slice(space + 1).trim()
  };
}

function showHelp() {
  print("BLACKBOX COMMAND REFERENCE", "success");
  print("SYSTEM: help, tutorial, about, status, system, uname, hostname, whoami, id, groups, users, uptime, time, date, cal, count");
  print("ACCESS: login guest | login developer");
  print("TERMINAL: clear, history, logs, echo <text>, env, printenv, which, man");
  print("FILES: pwd, ls [path], mkdir <folder>, touch <file>, cat <file>");
  print("       write <file> <text>, append <file> <text>, cd <folder>, tree, rm <item>");
  print("TOOLS: df, du, free, ps, top, head, tail, wc, sort, rev, basename, dirname");
  print("FUN: joke [count], cowsay <text>, matrix, coffee, easteregg");
  print("SEARCH: find <name>, grep <word> <file>");
  print("SECURITY: scan, security");
  print("SETTINGS: settings, settings scan standard|deep");
  print("DATA: export, import <JSON text>");
  print("Tip: put spaces inside quotes to keep them together, e.g. write notes.txt \"Hello world\"");
  print("All file commands operate only in BLACKBOX's virtual storage.", "muted");
}

function showTutorial() {
  print("QUICK START TUTORIAL", "success");
  print("1. ls                         List the starter files and folders.");
  print("2. touch notes.txt            Create a virtual file.");
  print('3. write notes.txt "Hello!"   Save text in that file.');
  print("4. cat notes.txt              Read the file.");
  print("5. mkdir experiments          Create a folder.");
  print("6. cd experiments             Enter the folder.");
  print("7. pwd                        Show your current virtual path.");
  print("8. cd ..                      Return to the previous folder.");
  print("9. find notes.txt             Search for a name.");
  print("10. export                    Print a backup of your virtual data.");
  print("11. uname -a                  Inspect the simulated Linux system.");
  print("12. joke 5                    Get five developer jokes.");
}

function listFolder(path = "") {
  const node = path ? resolvePath(path) : getFolder();
  if (!node) return print("ERROR: Path not found.", "error");
  if (node.type !== "folder") return print("ERROR: That path is a file.", "error");
  const names = Object.keys(node.children || {}).sort();
  if (!names.length) return print("Directory is empty.", "muted");
  names.forEach(name => {
    const item = node.children[name];
    print((item.type === "folder" ? "[DIR]  " : "[FILE] ") + name, item.type === "folder" ? "success" : "");
  });
}

function makeItem(type, path) {
  if (!path) return print("ERROR: A name is required.", "error");
  const { parent, name } = resolveParent(path);
  if (!parent || parent.type !== "folder") return print("ERROR: Parent directory not found.", "error");
  if (!name || name === "." || name === "..") return print("ERROR: Invalid name.", "error");
  if (Object.prototype.hasOwnProperty.call(parent.children, name)) return print("ERROR: That name already exists.", "error");
  parent.children[name] = type === "folder"
    ? { type: "folder", children: {} }
    : { type: "file", content: "" };
  persist();
  logEvent(`${type} created: ${path}`);
  print(`${type === "folder" ? "Folder" : "File"} created: ${name}`, "success");
  renderFiles();
}

function writeFile(path, content, append = false) {
  const node = resolvePath(path);
  if (!node) return print("ERROR: File not found. Create it with touch first.", "error");
  if (node.type !== "file") return print("ERROR: Cannot write to a directory.", "error");
  node.content = append ? (node.content || "") + content : content;
  persist();
  logEvent(`${append ? "Text appended to" : "File updated"}: ${path}`);
  print(`${append ? "Text appended to" : "File saved"}: ${path}`, "success");
}

function showTree(node, prefix = "") {
  const entries = Object.entries(node.children || {}).sort(([a], [b]) => a.localeCompare(b));
  entries.forEach(([name, item], index) => {
    const last = index === entries.length - 1;
    print(prefix + (last ? "└── " : "├── ") + name + (item.type === "folder" ? "/" : ""));
    if (item.type === "folder") showTree(item, prefix + (last ? "    " : "│   "));
  });
}

function findItems(query, node = fileSystem.root, path = "/root", results = []) {
  for (const [name, item] of Object.entries(node.children || {})) {
    const itemPath = path + "/" + name;
    if (name.toLowerCase().includes(query.toLowerCase())) results.push(`${item.type === "folder" ? "[DIR]" : "[FILE]"} ${itemPath}`);
    if (item.type === "folder") findItems(query, item, itemPath, results);
  }
  return results;
}

function renderFiles() {
  const folder = getFolder() || fileSystem.root;
  $("explorerPath").textContent = "/" + currentDirectory.join("/");
  $("promptPath").textContent = getPath();
  const list = $("fileList");
  list.innerHTML = "";
  const names = Object.keys(folder.children || {}).sort();
  if (!names.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "This folder is empty.";
    list.appendChild(empty);
    return;
  }
  names.forEach(name => {
    const item = folder.children[name];
    const row = document.createElement("div");
    row.className = "file-entry" + (item.type === "folder" ? " folder" : "");
    const symbol = document.createElement("span");
    symbol.className = "file-symbol";
    symbol.textContent = item.type === "folder" ? "▰" : "▤";
    const label = document.createElement("span");
    label.textContent = name;
    row.append(symbol, label);
    list.appendChild(row);
  });
}

function renderEvents() {
  const list = $("recentEvents");
  list.innerHTML = "";
  const recent = eventLog.slice(-5).reverse();
  if (!recent.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No events recorded yet.";
    list.appendChild(empty);
    return;
  }
  recent.forEach(event => {
    const row = document.createElement("div");
    row.className = "event-entry";
    row.textContent = event;
    list.appendChild(row);
  });
}

function renderDashboard() {
  $("commandCount").textContent = commandHistory.length;
  $("uptime").textContent = Math.floor((Date.now() - startedAt) / 1000) + "s";
  $("activeRole").textContent = currentRole.toUpperCase();
  $("roleDescription").textContent = currentRole === "developer" ? "Demo role · not authentication" : "Demo role · not authentication";
  $("roleText").textContent = currentRole === "developer"
    ? "Developer demo mode is active. This is not a protected account."
    : "Guest demo mode is active. This is not a protected account.";
  $("developerButton").classList.toggle("active", currentRole === "developer");
  $("guestButton").classList.toggle("active", currentRole === "guest");
}

function setRole(role) {
  currentRole = role;
  localStorage.setItem(KEYS.role, role);
  logEvent(`${role} role activated`);
  renderDashboard();
  print(role === "developer" ? "Developer access granted." : "Guest access activated.", "success");
  showToast("Role changed to " + role);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function scanSystem() {
  const checks = [
    ["Virtual filesystem", "OK"],
    ["Command history", "OK"],
    ["Event journal", "OK"],
    ["Browser storage", "AVAILABLE"],
    ["Demo role selector", "LOCAL ONLY"]
  ];
  print(`Starting ${settings.scanLevel} diagnostic scan...`, "muted");
  checks.forEach(([name, result]) => print(`${name.padEnd(22, " ")} [${result}]`, "success"));
  settings.lastScan = new Date().toLocaleString();
  persist();
  logEvent(`Diagnostic scan completed (${settings.scanLevel})`);
  print("Scan complete. No real device or network scan was performed.", "success");
}

function runSecurity() {
  print("BLACKBOX SIMULATED SECURITY REPORT", "success");
  print("Demo role: " + currentRole + " (browser-side only; not authentication)");
  print("Saved event records: " + eventLog.length);
  print("Virtual storage: isolated from your computer's real files");
  print("Browser persistence: localStorage");
  print("Flask host: serves this app only; no shell execution is exposed.");
  print("This is an educational simulation, not a security scanner.", "muted");
}

function safeImport(jsonText) {
  let data;
  try { data = JSON.parse(jsonText); } catch { return print("ERROR: Import data is not valid JSON.", "error"); }
  if (!data || !data.fileSystem || !data.fileSystem.root || data.fileSystem.root.type !== "folder" ||
      !data.fileSystem.root.children || typeof data.fileSystem.root.children !== "object") {
    return print("ERROR: Backup format is not recognized.", "error");
  }
  fileSystem = data.fileSystem;
  if (data.events && Array.isArray(data.events)) eventLog = data.events.slice(-60);
  persist();
  renderFiles();
  renderEvents();
  print("Virtual filesystem imported successfully.", "success");
  logEvent("Backup imported");
}

const DEVELOPER_JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "There are 10 kinds of people: those who understand binary and those who don't.",
  "A SQL query walks into a bar, walks up to two tables, and asks: 'Can I join you?'",
  "Why did the developer go broke? Because they used up all their cache.",
  "A programmer's spouse says: 'Go to the store and get a loaf of bread. If they have eggs, get a dozen.' They come home with 12 loaves.",
  "Why was the JavaScript developer sad? They didn't Node how to Express themselves.",
  "Debugging: being the detective in a crime movie where you are also the criminal.",
  "Why do Java developers wear glasses? Because they don't C#.",
  "I changed my password to 'incorrect'. Now the computer tells me when I get it wrong.",
  "The programmer got stuck in the shower because the instructions said: Lather, rinse, repeat.",
  "Why did the function break up with the loop? It needed space to return.",
  "There are only two hard things in computer science: cache invalidation, naming things, and off-by-one errors.",
  "A byte walks into a café. The barista asks: 'What's your order?' It says: 'Just one bit.'",
  "Why did the computer catch a cold? It left its Windows open.",
  "My code works perfectly. I have no idea why. Please don't make me touch it.",
  "Why did the developer bring a ladder? The bug was on a higher level.",
  "An optimist sees a glass half full. A pessimist sees it half empty. A developer sees a glass twice the required size.",
  "Why are assembly programmers always soaking wet? They work below C-level.",
  "The cloud is just someone else's computer. The fog is when even they don't know where it is.",
  "I would tell you a UDP joke, but you might not get it.",
  "Why did the CSS developer walk into the bar? To get a better position.",
  "Git told me to commit. I said I need space, then it made a branch.",
  "Why did the API get promoted? It had excellent endpoints.",
  "A bug is never alone. It arrives with its entire family of edge cases.",
  "Why did the developer hate nature? Too many bugs and no stack trace.",
  "My code has 99 little bugs. I fixed one, compiled again, and now it has 127.",
  "Why was the computer tired after work? It had a hard drive.",
  "The best thing about a Boolean is that even when you're wrong, you're only off by a bit.",
  "Why did the developer use Git? They wanted to keep their options open.",
  "A programmer's favorite place to hang out? Foo Bar."
];

const MANUALS = {
  ls: "ls [path] — list entries in a virtual directory. BLACKBOX supports a simplified ls; it does not read your host filesystem.",
  cd: "cd [directory] — change the current virtual directory. Use cd .. to go up or cd ~ to return home.",
  grep: "grep <word> <file> — show lines containing a word in a BLACKBOX virtual file.",
  find: "find <name-fragment> — search names in the BLACKBOX virtual filesystem.",
  uname: "uname [-a] — display simulated operating-system information.",
  joke: "joke [count] — print random developer jokes. Count is limited to 20 per command.",
  sudo: "sudo — intentionally unavailable. BLACKBOX never grants real system privileges."
};

function printRandomJokes(count = 1) {
  const amount = Math.max(1, Math.min(20, Number.parseInt(count, 10) || 1));
  const pool = [...DEVELOPER_JOKES];
  for (let i = 0; i < amount; i++) {
    const index = Math.floor(Math.random() * pool.length);
    print(`${i + 1}. ${pool.splice(index, 1)[0]}`, "success");
  }
  if (Number.parseInt(count, 10) > 20) print("Joke limit: 20 per command. Even comedy needs rate limits.", "muted");
}

function printCowsay(message) {
  const text = (message || "Moo from BLACKBOX!").slice(0, 100);
  const border = "-".repeat(text.length + 2);
  print(` ${border}\n< ${text} >\n ${border}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`, "success");
}

function simulatedFileStats() {
  let files = 0, dirs = 0, bytes = 0;
  const walk = folder => Object.values(folder.children || {}).forEach(item => {
    if (item.type === "folder") { dirs++; walk(item); }
    else { files++; bytes += String(item.content || "").length; }
  });
  walk(fileSystem.root);
  return { files, dirs, bytes };
}

function executeCommand(raw) {
  const line = raw.trim();
  if (!line) return;
  printPrompt(line);
  commandHistory.push(line);
  if (commandHistory.length > 200) commandHistory = commandHistory.slice(-200);
  historyIndex = commandHistory.length;
  localStorage.setItem(KEYS.history, JSON.stringify(commandHistory));

  const parsed = parseCommand(line);
  const command = parsed.name;
  const args = parsed.args;
  const tokens = tokenize(args);
  const allowedGuest = new Set(["help", "tutorial", "about", "status", "whoami", "access", "time", "date", "pwd", "ls", "cat", "find", "history", "clear", "login", "echo", "uname", "hostname", "id", "groups", "users", "env", "printenv", "which", "man", "df", "du", "free", "ps", "top", "cal", "joke", "cowsay", "matrix", "coffee", "easteregg", "head", "tail", "wc", "sort", "rev", "basename", "dirname", "sudo", "vim", "42"]);
  if (currentRole === "guest" && !allowedGuest.has(command)) {
    print("ACCESS DENIED: guest role cannot run this command.", "error");
    logEvent("Guest command blocked: " + line);
    return;
  }

  switch (command) {
    case "help": showHelp(); break;
    case "tutorial": showTutorial(); break;
    case "about":
      print("BLACKBOX is a browser-based virtual developer environment.");
      print("Version: 2.1.0 | Built with HTML, CSS and JavaScript.");
      print("It simulates terminal commands and virtual storage; it is not an operating system.");
      break;
    case "status":
      print("SYSTEM STATUS: ONLINE", "success");
      print("ROLE: " + currentRole.toUpperCase());
      print("VIRTUAL STORAGE: READY");
      print("LAST DIAGNOSTIC: " + (settings.lastScan || "Not run yet"));
      break;
    case "system":
      print("BLACKBOX VIRTUAL ENVIRONMENT / 2.1.0");
      print("Runtime: " + navigator.userAgent);
      print("Storage: browser localStorage");
      print("Virtual path: /" + currentDirectory.join("/"));
      break;
    case "whoami": print("Current role: " + currentRole); break;
    case "access": print(currentRole === "developer" ? "Developer access granted." : "Guest access: read-only commands."); break;
    case "login":
      if (tokens[0] === "guest") setRole("guest");
      else if (tokens[0] === "developer") setRole("developer");
      else print("Usage: login guest  OR  login developer", "warning");
      break;
    case "clear": output.innerHTML = ""; break;
    case "hello": print("Hello, developer. BLACKBOX is ready.", "success"); break;
    case "echo": print(args); break;
    case "uname": print(args === "-a" ? "Linux blackbox 6.8.0-blackbox #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" : "Linux"); break;
    case "hostname": print("blackbox"); break;
    case "id": print(`uid=1000(${currentRole}) gid=1000(${currentRole}) groups=1000(${currentRole}),27(sudo-simulated)`); break;
    case "groups": print("developer sudo-simulated"); break;
    case "users": print("developer"); break;
    case "env":
    case "printenv": {
      const vars = { USER: "developer", HOME: "/root", SHELL: "/bin/blackbox-sim", TERM: "xterm-256color", LANG: "en_US.UTF-8", PATH: "/usr/local/bin:/usr/bin:/bin", BLACKBOX: "true" };
      if (command === "printenv" && args) print(vars[args] || "");
      else Object.entries(vars).forEach(([key, value]) => print(`${key}=${value}`));
      break;
    }
    case "which": {
      const known = new Set(["ls", "cd", "pwd", "cat", "mkdir", "touch", "grep", "find", "uname", "whoami", "date", "echo", "clear", "head", "tail", "wc", "sort", "rev"]);
      print(known.has(args) ? `/usr/bin/${args}` : `${args || "which"}: command not found`, known.has(args) ? "success" : "warning");
      break;
    }
    case "man": {
      const topic = args || "help";
      print(MANUALS[topic] || `No manual entry for ${topic}. Try: man ls, man grep, man uname, man joke`, "muted");
      break;
    }
    case "df": {
      const stats = simulatedFileStats();
      print("Filesystem      Size  Used  Available  Use%  Mounted on");
      print(`blackbox-virt   1.0G  ${Math.max(1, Math.ceil(stats.bytes / 1024))}K   1023M      1%    /`);
      print("Note: illustrative virtual disk statistics only.", "muted");
      break;
    }
    case "du": {
      const stats = simulatedFileStats();
      print(`${Math.max(1, Math.ceil(stats.bytes / 1024))}K  ${args || "."}`);
      print(`Virtual contents: ${stats.files} files, ${stats.dirs} directories.`, "muted");
      break;
    }
    case "free":
      print("              total        used        free      shared  buff/cache   available");
      print("Mem:          4096M       1024M       2048M         32M       1024M       2800M");
      print("Swap:         1024M          0M       1024M");
      print("Illustrative values; no host memory is inspected.", "muted");
      break;
    case "ps":
    case "top":
      print("PID  USER       STAT  COMMAND");
      print("1    developer  S     blackbox-session");
      print("2    developer  S     virtual-filesystem");
      print("3    developer  R     command-dispatcher");
      print("Process list is simulated, not your computer's processes.", "muted");
      break;
    case "cal": {
      const now = new Date();
      const year = now.getFullYear(), month = now.getMonth();
      const first = new Date(year, month, 1).getDay();
      const days = new Date(year, month + 1, 0).getDate();
      print(`${now.toLocaleString(undefined, { month: "long" })} ${year}`);
      print("Su Mo Tu We Th Fr Sa");
      let row = "   ".repeat(first);
      for (let day = 1; day <= days; day++) { row += String(day).padStart(2, " ") + " "; if ((first + day) % 7 === 0 || day === days) { print(row); row = ""; } }
      break;
    }
    case "head":
    case "tail":
    case "wc":
    case "sort": {
      const file = tokens[tokens.length - 1];
      const node = resolvePath(file || "");
      if (!node || node.type !== "file") { print(`Usage: ${command} <virtual-file>`, "warning"); break; }
      const lines = String(node.content || "").split(/\r?\n/);
      if (command === "head") lines.slice(0, 10).forEach(line => print(line));
      else if (command === "tail") lines.slice(-10).forEach(line => print(line));
      else if (command === "wc") print(`${lines.length} ${String(node.content || "").split(/\s+/).filter(Boolean).length} ${String(node.content || "").length} ${file}`);
      else lines.sort((a, b) => a.localeCompare(b)).forEach(line => print(line));
      break;
    }
    case "rev": print(args.split("").reverse().join("")); break;
    case "basename": print((args || "").replace(/\/+$/, "").split("/").pop() || "."); break;
    case "dirname": { const parts = (args || ".").replace(/\/+$/, "").split("/"); parts.pop(); print(parts.join("/") || "."); break; }
    case "joke": printRandomJokes(args); break;
    case "cowsay": printCowsay(args); break;
    case "matrix":
      print("Wake up, developer...", "success");
      print("The terminal has you. Follow the white rabbit.");
      print("There is no spoon. There is only semicolon.", "success");
      print("Knock, knock, Neo. (Try: easteregg)", "muted");
      break;
    case "coffee": print("     ( (\n      ) )\n    ........\n    |      |]\n    \\      /\n     `----'\nCoffee.exe loaded. Programmer fuel: +10 (imaginary).", "success"); break;
    case "easteregg":
      print("BLACKBOX SECRET #01 UNLOCKED", "success");
      print("You found the hidden developer lounge.");
      print("Achievement: Curious Mind — awarded for exploring beyond help.", "success");
      print("Secret hint: try 'sudo make me a sandwich'.", "muted");
      break;
    case "sudo":
      print("Permission denied: BLACKBOX does not execute privileged host commands.", "error");
      if (args.includes("sandwich")) print("Okay. But only if you can pass the sandwich unit tests.", "success");
      else print("Nice try. The real root is the friends we made along the way.", "muted");
      break;
    case "vim": print("You are now in VIM. Just kidding. This simulator has no editor. Try: nano (also simulated).", "success"); break;
    case "42": print("The answer to life, the universe, and everything. Now find the question.", "success"); break;
    case "time": print("Local time: " + new Date().toLocaleTimeString()); break;
    case "date": print("Local date: " + new Date().toLocaleDateString()); break;
    case "uptime": print("Session uptime: " + Math.floor((Date.now() - startedAt) / 1000) + " seconds"); break;
    case "count": print("Commands entered: " + commandHistory.length); break;
    case "history":
      if (!commandHistory.length) print("No commands in history.", "muted");
      else commandHistory.slice(-25).forEach((entry, i) => print(`${commandHistory.length - Math.min(25, commandHistory.length) + i + 1}  ${entry}`, "muted"));
      break;
    case "logs":
      if (!eventLog.length) print("No event logs available.", "muted");
      else eventLog.slice(-30).forEach(entry => print(entry, "muted"));
      break;
    case "scan": scanSystem(); break;
    case "security": runSecurity(); break;
    case "settings":
      if (tokens[0] === "scan" && ["standard", "deep"].includes(tokens[1])) {
        settings.scanLevel = tokens[1]; persist();
        print("Diagnostic scan level set to " + tokens[1] + ".", "success");
      } else {
        print("BLACKBOX SETTINGS", "success");
        print("Scan level: " + settings.scanLevel);
        print("Change with: settings scan standard  OR  settings scan deep");
      }
      break;
    case "pwd": print("/" + currentDirectory.join("/")); break;
    case "ls": listFolder(args); break;
    case "mkdir": makeItem("folder", args); break;
    case "touch": makeItem("file", args); break;
    case "cat": {
      const node = resolvePath(args);
      if (!node) print("ERROR: File not found.", "error");
      else if (node.type !== "file") print("ERROR: This is a directory.", "error");
      else print(node.content || "File is empty.", node.content ? "" : "muted");
      break;
    }
    case "write":
    case "append": {
      const first = args.search(/\s/);
      if (first < 0) { print(`Usage: ${command} <file> <text>`, "warning"); break; }
      const file = args.slice(0, first);
      let content = args.slice(first + 1).trim();
      if ((content.startsWith('"') && content.endsWith('"')) || (content.startsWith("'") && content.endsWith("'"))) content = content.slice(1, -1);
      writeFile(file, content, command === "append");
      break;
    }
    case "cd": {
      if (!args || args === "~" || args === "/") currentDirectory = ["root"];
      else if (args === "..") { if (currentDirectory.length > 1) currentDirectory.pop(); }
      else {
        const target = resolvePath(args);
        if (!target) { print("ERROR: Directory not found.", "error"); break; }
        if (target.type !== "folder") { print("ERROR: That item is a file.", "error"); break; }
        if (args.startsWith("/")) currentDirectory = ["root", ...args.split("/").filter(Boolean)];
        else if (args.startsWith("~/")) currentDirectory = ["root", ...args.slice(2).split("/").filter(Boolean)];
        else currentDirectory = [...currentDirectory, ...args.split("/").filter(Boolean)];
      }
      print("Current directory: " + getPath(), "success");
      break;
    }
    case "tree": print("root/"); showTree(fileSystem.root); break;
    case "rm": {
      if (!args) { print("Usage: rm <file-or-empty-folder>", "warning"); break; }
      const { parent, name } = resolveParent(args);
      if (!parent || !parent.children || !Object.prototype.hasOwnProperty.call(parent.children, name)) { print("ERROR: Item not found.", "error"); break; }
      const target = parent.children[name];
      if (target.type === "folder" && Object.keys(target.children).length) { print("ERROR: Folder is not empty.", "warning"); break; }
      delete parent.children[name];
      persist(); logEvent("Virtual item removed: " + args);
      print("Removed virtual item: " + name, "success"); renderFiles();
      break;
    }
    case "find": {
      if (!args) { print("Usage: find <name-fragment>", "warning"); break; }
      const results = findItems(args);
      if (!results.length) print("No matching virtual items found.", "muted");
      else results.forEach(result => print(result, "success"));
      break;
    }
    case "grep": {
      if (tokens.length < 2) { print("Usage: grep <word> <file>", "warning"); break; }
      const term = tokens[0];
      const filePath = tokens.slice(1).join(" ");
      const node = resolvePath(filePath);
      if (!node || node.type !== "file") { print("ERROR: File not found.", "error"); break; }
      const lines = (node.content || "").split(/\r?\n/);
      const matches = lines.map((text, index) => ({ text, index })).filter(row => row.text.toLowerCase().includes(term.toLowerCase()));
      if (!matches.length) print("No matching text found.", "muted");
      else matches.forEach(row => print(`${row.index + 1}: ${row.text}`, "success"));
      break;
    }
    case "export": {
      const backup = { version: "2.1.0", fileSystem, events: eventLog };
      print("BACKUP JSON (copy this text and store it safely):", "success");
      print(JSON.stringify(backup));
      break;
    }
    case "import": safeImport(args); break;
    default: print(`Command not recognized: ${command}. Type 'help'.`, "warning");
  }

  renderDashboard();
  renderFiles();
}

function runInput(command) {
  executeCommand(command);
  input.value = "";
  input.focus();
}

$("commandForm").addEventListener("submit", event => {
  event.preventDefault();
  runInput(input.value);
});

input.addEventListener("keydown", event => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (historyIndex > 0) historyIndex--;
    input.value = commandHistory[historyIndex] || "";
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (historyIndex < commandHistory.length - 1) historyIndex++;
    else historyIndex = commandHistory.length;
    input.value = commandHistory[historyIndex] || "";
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    output.innerHTML = "";
  }
});

document.querySelectorAll(".quick-command").forEach(button => {
  button.addEventListener("click", () => runInput(button.dataset.command));
});
$("clearButton").addEventListener("click", () => { output.innerHTML = ""; input.focus(); });
$("refreshFiles").addEventListener("click", renderFiles);
$("developerButton").addEventListener("click", () => setRole("developer"));
$("guestButton").addEventListener("click", () => setRole("guest"));
$("helpButton").addEventListener("click", () => $("helpModal").classList.remove("hidden"));
$("closeHelp").addEventListener("click", () => $("helpModal").classList.add("hidden"));
$("helpModal").addEventListener("click", event => {
  if (event.target === $("helpModal")) $("helpModal").classList.add("hidden");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") $("helpModal").classList.add("hidden");
});
$("resetButton").addEventListener("click", () => {
  const confirmed = window.confirm("Reset BLACKBOX local data? This removes saved virtual files, history, events and role from this browser.");
  if (!confirmed) return;
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  commandHistory = [];
  eventLog = [];
  currentRole = "developer";
  fileSystem = JSON.parse(JSON.stringify(DEFAULT_FS));
  settings = { scanLevel: "standard", lastScan: null };
  currentDirectory = ["root"];
  historyIndex = 0;
  output.innerHTML = "";
  print("BLACKBOX local data has been reset.", "success");
  logEvent("Local data reset");
  renderDashboard(); renderFiles(); renderEvents(); input.focus();
});

setInterval(renderDashboard, 1000);
renderDashboard();
renderFiles();
renderEvents();

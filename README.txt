BLACKBOX M021 — FLASK HOST + COMMAND EXPANSION
==============================================

WHAT'S INCLUDED
---------------
index.html      Terminal interface
style.css       Responsive terminal design
script.js       Command interpreter and virtual filesystem
app.py          Flask web host with security headers and asset allowlist
requirements.txt Python dependencies
Procfile        Gunicorn start command for common hosting platforms

RUN LOCALLY
-----------
1. Install Python 3.10 or newer.
2. Open a terminal in this folder.
3. Create and activate a virtual environment (recommended):
     python -m venv .venv
   Windows:
     .venv\Scripts\activate
   macOS/Linux:
     source .venv/bin/activate
4. Install dependencies:
     pip install -r requirements.txt
5. Start BLACKBOX:
     python app.py
6. Open http://127.0.0.1:5000

DEPLOY
------
Deploy this folder to a Python hosting service that supports Flask and Gunicorn.
The included Procfile starts the app with Gunicorn. Set the service start command
as `gunicorn --workers 2 --threads 4 --timeout 30 --bind 0.0.0.0:$PORT app:app`
if the host does not automatically read Procfile. Use HTTPS at the hosting layer.

NEW SIMULATED LINUX COMMANDS
----------------------------
uname [-a]       hostname         id              groups
users            env              printenv [KEY]  which <command>
man <command>    df               du              free
ps               top              cal             head <file>
tail <file>      wc <file>        sort <file>     rev <text>
basename <path>  dirname <path>

FUN COMMANDS + EASTER EGGS
--------------------------
joke [count]     Random developer jokes; count is capped at 20 per command.
cowsay <text>    ASCII cow says your message.
coffee           Programmer fuel.
matrix           A familiar cinematic nod.
easteregg        Unlock the hidden developer lounge.
42               The answer.
sudo ...         A playful refusal; no elevated execution is available.
vim              A joke about the editor everyone knows how to exit.

IMPORTANT: WHAT THIS APP DOES AND DOES NOT DO
---------------------------------------------
BLACKBOX remains a learning simulator. Commands are interpreted by JavaScript and
operate on a virtual filesystem in browser localStorage. Linux-looking outputs
such as uname, df, free, ps and top are illustrative simulations. No command is
executed by a real Linux shell, and the Flask backend deliberately does not expose
shell execution, subprocesses, host files, or arbitrary filesystem paths.

The Flask server only serves the application and a read-only /api/health endpoint.
It adds Content-Security-Policy and other browser security headers, limits request
body size, and serves only an explicit list of static assets.

The Developer/Guest selector is a local simulation feature, NOT real authentication
or authorization. It is not suitable for protecting private data or privileged
features on a public multi-user service. Browser data is local to each visitor's
browser and is not stored in a central account database. Do not enter real passwords,
secrets, or personal information.

If real Linux command execution is added in a future version, it must run inside
short-lived, isolated containers with strict CPU, memory, process, network and disk
limits, non-root users, and server-side authorization. Never pass raw user input to
an operating-system shell.

BACKUP / RESET
--------------
Use `export` to display a JSON backup and `import <JSON>` to restore it.
The RESET LOCAL DATA button clears this browser's saved virtual data.

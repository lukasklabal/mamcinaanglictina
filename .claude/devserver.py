# Lokální vývojový server bez cache (python3 .claude/devserver.py)
import http.server, functools

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

http.server.ThreadingHTTPServer(('', 5173), functools.partial(NoCache, directory='.')).serve_forever()

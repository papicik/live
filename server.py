#!/usr/bin/env python3
"""
Lightweight Server matching server.js for instant local execution
Serves /public static files, handles /api/books from data/books.json,
and can run a background synthesis worker every 5 minutes.
"""
import http.server
import socketserver
import os
import json
import threading
import time

PORT = 8085
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
DATA_FILE = os.path.join(BASE_DIR, 'data', 'books.json')

class LibraryHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        # API endpoint: /api/books
        if self.path == '/api/books' or self.path.startswith('/api/books?'):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = f.read()
            else:
                data = '[]'
            self.wfile.write(data.encode('utf-8'))
            return

        # Direct access to data/books.json
        if self.path == '/data/books.json':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = f.read()
            else:
                data = '[]'
            self.wfile.write(data.encode('utf-8'))
            return

        # Fallback to serving static files from public/
        return super().do_GET()

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), LibraryHandler) as httpd:
        print(f"Serving Autonomous AI Library at http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == '__main__':
    run_server()

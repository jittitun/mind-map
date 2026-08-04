"""Local dev server for Diagram+ — เหมือน `python -m http.server` แต่ปิด browser cache
เพื่อให้ทดสอบระหว่างพัฒนาเห็นไฟล์ล่าสุดเสมอ ไม่เกี่ยวกับตัว production (GitHub Pages serve ตรงๆ)"""

import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    http.server.test(HandlerClass=NoCacheHandler, port=5173)

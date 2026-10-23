"""SQLite бота: посты, черновики, настройки, лимит отзывов. Никакого состояния в памяти процесса."""
import sqlite3
import time


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS posts(date TEXT, city TEXT, kind TEXT, status TEXT, msg_id INTEGER);
            CREATE TABLE IF NOT EXISTS drafts(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, city TEXT,
                caption TEXT, photo_file TEXT, created TEXT);
            CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE IF NOT EXISTS fb(user_id INTEGER, ts REAL);
            CREATE TABLE IF NOT EXISTS fb_map(owner_msg_id INTEGER PRIMARY KEY, user_id INTEGER);
        ''')
        self.db.commit()

    # настройки (mode=draft|auto, last_news_date, await_text=<id черновика>)
    def get(self, key, default=''):
        r = self.db.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
        return r['value'] if r else default

    def set(self, key, value):
        self.db.execute('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                        (key, str(value)))
        self.db.commit()

    # посты: kind = day|frame|news, status = draft|published|skipped
    def add_post(self, date, city, kind, status, msg_id=None):
        self.db.execute('INSERT INTO posts VALUES(?,?,?,?,?)', (date, city, kind, status, msg_id))
        self.db.commit()

    def update_post(self, date, kind, **fields):
        """Правит запись дня (последнюю по rowid) для kind: city, status, msg_id."""
        sets = ', '.join(f'{k}=?' for k in fields)
        self.db.execute(f'UPDATE posts SET {sets} WHERE rowid=(SELECT MAX(rowid) FROM posts WHERE date=? AND kind=?)',
                        (*fields.values(), date, kind))
        self.db.commit()

    def has_post(self, date, kind):
        return self.db.execute('SELECT 1 FROM posts WHERE date=? AND kind=?', (date, kind)).fetchone() is not None

    def history(self, kind='day'):
        """[(дата, город)] показанных окон (черновики и опубликованные; пропущенные не считаются)."""
        rows = self.db.execute("SELECT date, city FROM posts WHERE kind=? AND status!='skipped'", (kind,)).fetchall()
        return [(r['date'], r['city']) for r in rows]

    def last_post(self):
        r = self.db.execute("SELECT * FROM posts WHERE status='published' ORDER BY rowid DESC LIMIT 1").fetchone()
        return dict(r) if r else None

    # черновики
    def add_draft(self, kind, city, caption, photo_file, created):
        cur = self.db.execute('INSERT INTO drafts(kind,city,caption,photo_file,created) VALUES(?,?,?,?,?)',
                              (kind, city, caption, photo_file, created))
        self.db.commit()
        return cur.lastrowid

    def get_draft(self, draft_id):
        r = self.db.execute('SELECT * FROM drafts WHERE id=?', (draft_id,)).fetchone()
        return dict(r) if r else None

    def update_draft(self, draft_id, **fields):
        sets = ', '.join(f'{k}=?' for k in fields)
        self.db.execute(f'UPDATE drafts SET {sets} WHERE id=?', (*fields.values(), draft_id))
        self.db.commit()

    def del_draft(self, draft_id):
        self.db.execute('DELETE FROM drafts WHERE id=?', (draft_id,))
        self.db.commit()

    # отзывы: лимит и привязка копии у владельца к автору
    def fb_count(self, user_id, window=3600):
        return self.db.execute('SELECT COUNT(*) FROM fb WHERE user_id=? AND ts>?',
                               (user_id, time.time() - window)).fetchone()[0]

    def fb_add(self, user_id):
        self.db.execute('DELETE FROM fb WHERE ts<?', (time.time() - 86400,))
        self.db.execute('INSERT INTO fb VALUES(?,?)', (user_id, time.time()))
        self.db.commit()

    def map_add(self, owner_msg_id, user_id):
        self.db.execute('INSERT OR REPLACE INTO fb_map VALUES(?,?)', (owner_msg_id, user_id))
        self.db.commit()

    def map_get(self, owner_msg_id):
        r = self.db.execute('SELECT user_id FROM fb_map WHERE owner_msg_id=?', (owner_msg_id,)).fetchone()
        return r['user_id'] if r else None

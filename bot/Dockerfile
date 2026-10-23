# Браузер Chromium уже внутри образа; версия playwright в requirements.txt должна совпадать с тегом
FROM mcr.microsoft.com/playwright/python:v1.48.0-jammy
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py ./
# /data — том с SQLite и черновиками; владелец pwuser, чтобы новый том унаследовал права
RUN mkdir -p /data && chown pwuser:pwuser /data
USER pwuser
CMD ["python", "-u", "app.py"]

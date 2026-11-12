FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Os dados ficam no disco persistente montado em /data (não dentro da imagem)
ENV DATA_DIR=/data PYTHONUNBUFFERED=1
RUN mkdir -p /data
EXPOSE 10000
CMD ["python", "servidor.py"]

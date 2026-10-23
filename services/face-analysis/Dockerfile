FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --uid 10001 --create-home face \
    && mkdir /data /models && chown face:face /data
COPY face_service ./face_service
USER face
EXPOSE 8080
VOLUME ["/data"]
CMD ["uvicorn", "face_service.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]

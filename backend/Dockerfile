# ---- 构建阶段 ----
FROM golang:1.26-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /app/server ./cmd/api

# ---- 运行阶段 ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
WORKDIR /app
COPY --from=builder /app/server /app/server
COPY contracts.json /app/contracts.json
RUN mkdir -p /app/data && chown -R app:app /app
USER app
EXPOSE 8080
ENV PORT=8080
VOLUME ["/app/data"]
CMD ["/app/server"]

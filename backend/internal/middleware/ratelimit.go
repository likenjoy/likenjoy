package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter 内存版滑动窗口限流（生产可平滑替换为 Redis）
// 用途：登录/注册等敏感接口防暴力破解与撞库
type RateLimiter struct {
	mu       sync.Mutex
	window   time.Duration
	limit    int
	requests map[string][]time.Time
}

func NewRateLimiter(window time.Duration, limit int) *RateLimiter {
	return &RateLimiter{
		window:   window,
		limit:    limit,
		requests: make(map[string][]time.Time),
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// 清理过期记录（惰性）
	kept := rl.requests[key][:0]
	for _, t := range rl.requests[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	rl.requests[key] = kept

	if len(kept) >= rl.limit {
		return false
	}
	rl.requests[key] = append(rl.requests[key], now)
	return true
}

// RateLimitMiddleware 按客户端 IP + 请求路径限流
func RateLimitMiddleware(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP() + "|" + c.FullPath()
		if !rl.Allow(key) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, please retry later"})
			return
		}
		c.Next()
	}
}

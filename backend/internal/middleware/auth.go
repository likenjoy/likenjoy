package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// UserValidator 实时校验用户状态与角色（防吊销失效：封禁/降权立即生效）
// 返回 (最新角色, 账户状态, 绑定钱包地址)。status 必须为 "active" 才放行。
type UserValidator func(userID string) (role string, status string, wallet string, err error)

// AuthMiddleware JWT 认证中间件
// 安全要点（对齐 OWASP JWT 指南 + T-REX 权限事故教训）：
//  1. 锁定签名算法为 HS256，拒绝 alg confusion / none 攻击
//  2. 角色以数据库实时值为准，不信任 token 内嵌角色（防降权不生效）
//  3. 账户状态（suspended/closed）实时拦截，无需等 token 过期
func AuthMiddleware(jwtSecret string, validate UserValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		token, err := jwt.ParseWithClaims(parts[1], &Claims{}, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		}, jwt.WithValidMethods([]string{"HS256"}))
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			return
		}

		uid, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user id in token"})
			return
		}

		role := claims.Role
		wallet := ""
		if validate != nil {
			dbRole, status, dbWallet, err := validate(claims.UserID)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user not found or token revoked"})
				return
			}
			if status != "active" {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "account is not active"})
				return
			}
			// 角色以数据库为准：降权/升权立即生效，旧 token 不残留旧权限
			role = dbRole
			wallet = dbWallet
		}

		c.Set("user_id", uid)
		c.Set("email", claims.Email)
		c.Set("role", role)
		c.Set("wallet_address", wallet)
		c.Next()
	}
}

func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "no role found"})
			return
		}
		for _, r := range allowedRoles {
			if role.(string) == r {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

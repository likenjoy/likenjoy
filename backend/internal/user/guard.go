package user

import (
	"errors"
	"sync"
	"time"
)

// ErrLocked 账户/来源已被临时锁定
var ErrLocked = errors.New("too many failed attempts, account temporarily locked")

// failState 单个 key 的失败状态
type failState struct {
	count       int
	lockedUntil time.Time
}

// LoginGuard 登录失败锁定（防暴力破解核心）
// 策略：同一 key（IP|邮箱）连续失败 maxFails 次 → 锁定 lockDuration。
// 与总次数限流（RateLimiter）互补：限流控频率，本组件控"失败后的惩罚"。
// 注意：单机内存实现，多实例部署时应替换为 Redis（key 加 TTL 即可迁移）。
type LoginGuard struct {
	mu           sync.Mutex
	maxFails     int
	lockDuration time.Duration
	now          func() time.Time // 可注入时钟（测试用）
	states       map[string]*failState
}

func NewLoginGuard(maxFails int, lockDuration time.Duration) *LoginGuard {
	return &LoginGuard{
		maxFails:     maxFails,
		lockDuration: lockDuration,
		now:          time.Now,
		states:       make(map[string]*failState),
	}
}

// Check 返回 key 是否被锁定；未锁定返回 nil
func (g *LoginGuard) Check(key string) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	st, ok := g.states[key]
	if !ok {
		return nil
	}
	if st.lockedUntil.After(g.now()) {
		return ErrLocked
	}
	// 仅当存在"已过期的锁定期"时才清除状态；
	// 未锁定（lockedUntil 零值）时保留失败计数，否则每次 Check 都会清零计数
	if !st.lockedUntil.IsZero() {
		delete(g.states, key)
	}
	return nil
}

// RecordFail 记录一次失败；达到阈值时返回 true（本次触发锁定）
func (g *LoginGuard) RecordFail(key string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	now := g.now()
	st, ok := g.states[key]
	if !ok {
		st = &failState{}
		g.states[key] = st
	} else if !st.lockedUntil.IsZero() && st.lockedUntil.Before(now) {
		// 锁定期已过，重新计数（零值 lockedUntil 不能当作"已过期"，
		// 否则每次失败都会重置计数导致永远无法触发锁定）
		st = &failState{}
		g.states[key] = st
	}
	st.count++
	if st.count >= g.maxFails {
		st.lockedUntil = now.Add(g.lockDuration)
		st.count = 0
		return true
	}
	return false
}

// Reset 登录成功后清除失败记录
func (g *LoginGuard) Reset(key string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	delete(g.states, key)
}

package user

import (
	"testing"
	"time"
)

func TestLoginGuardLockout(t *testing.T) {
	g := NewLoginGuard(5, time.Minute)
	key := "127.0.0.1|victim@test.com"

	// 前 4 次失败不应锁定
	for i := 1; i <= 4; i++ {
		if locked := g.RecordFail(key); locked {
			t.Fatalf("attempt %d: should not lock yet", i)
		}
	}
	// 第 5 次失败触发锁定
	if !g.RecordFail(key) {
		t.Fatal("attempt 5: should trigger lock")
	}
	// 锁定期间 Check 应报错
	if err := g.Check(key); err == nil {
		t.Fatal("Check should report locked")
	}
	// 重置后恢复
	g.Reset(key)
	if err := g.Check(key); err != nil {
		t.Fatal("after reset, Check should pass")
	}
}

func TestLoginGuardIndependentKeys(t *testing.T) {
	g := NewLoginGuard(5, time.Minute)
	keyA := "127.0.0.1|a@test.com"
	keyB := "127.0.0.1|b@test.com"

	for i := 1; i <= 5; i++ {
		g.RecordFail(keyA)
	}
	if err := g.Check(keyA); err == nil {
		t.Fatal("keyA should be locked")
	}
	// keyB 不受影响
	if err := g.Check(keyB); err != nil {
		t.Fatal("keyB should not be locked")
	}
}

func TestLoginGuardCheckDoesNotResetCount(t *testing.T) {
	// 回归：Check 在未锁定时不得清除失败计数（曾导致永远无法触发锁定）
	g := NewLoginGuard(5, time.Minute)
	key := "::1|victim@test.com"

	for i := 1; i <= 4; i++ {
		g.RecordFail(key)
		if err := g.Check(key); err != nil {
			t.Fatalf("attempt %d: Check should pass (not locked)", i)
		}
	}
	// 4 次失败 + Check 后，第 5 次失败应触发锁定
	if !g.RecordFail(key) {
		t.Fatal("attempt 5: should trigger lock despite Check calls in between")
	}
}

func TestLoginGuardLockExpiry(t *testing.T) {
	now := time.Now()
	g := NewLoginGuard(5, time.Minute)
	g.now = func() time.Time { return now }

	for i := 1; i <= 5; i++ {
		g.RecordFail("k")
	}
	if err := g.Check("k"); err == nil {
		t.Fatal("should be locked")
	}
	// 时钟前进 2 分钟 → 锁定过期
	now = now.Add(2 * time.Minute)
	if err := g.Check("k"); err != nil {
		t.Fatal("lock should have expired")
	}
	// 过期后再次失败重新计数（不应立刻再锁）
	for i := 1; i <= 3; i++ {
		if g.RecordFail("k") {
			t.Fatalf("attempt %d: should not lock after expiry", i)
		}
	}
}

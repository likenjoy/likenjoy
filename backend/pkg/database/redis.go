package database

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

func NewRedis(addr, password string) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}
	return rdb, nil
}

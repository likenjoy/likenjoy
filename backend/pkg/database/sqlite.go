package database

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func NewSQLite(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

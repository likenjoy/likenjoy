package ad

import (
	"database/sql"
	"time"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func scanAd(row interface{ Scan(...any) error }) (*Advertisement, error) {
	var a Advertisement
	var enabled int
	var createdAt, updatedAt string
	if err := row.Scan(&a.ID, &a.Title, &a.ImageURL, &a.LinkURL, &a.Position, &enabled, &a.SortOrder, &a.CreatedBy, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	a.Enabled = enabled == 1
	a.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
	a.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAt)
	return &a, nil
}

// Create 新增广告
func (r *Repository) Create(a *Advertisement) error {
	enabled := 0
	if a.Enabled {
		enabled = 1
	}
	_, err := r.db.Exec(
		`INSERT INTO advertisements (id, title, image_url, link_url, position, enabled, sort_order, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.Title, a.ImageURL, a.LinkURL, a.Position, enabled, a.SortOrder, a.CreatedBy,
	)
	return err
}

// Update 更新广告
func (r *Repository) Update(a *Advertisement) error {
	enabled := 0
	if a.Enabled {
		enabled = 1
	}
	_, err := r.db.Exec(
		`UPDATE advertisements SET title=?, image_url=?, link_url=?, position=?, enabled=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		a.Title, a.ImageURL, a.LinkURL, a.Position, enabled, a.SortOrder, a.ID,
	)
	return err
}

// Delete 删除广告
func (r *Repository) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM advertisements WHERE id=?`, id)
	return err
}

// List 全部广告（管理后台用，含停用）
func (r *Repository) List() ([]Advertisement, error) {
	rows, err := r.db.Query(`SELECT id, title, image_url, link_url, position, enabled, sort_order, created_by, created_at, updated_at FROM advertisements ORDER BY sort_order ASC, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Advertisement
	for rows.Next() {
		a, err := scanAd(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

// ListEnabledByPosition 公开接口：指定广告位的启用广告
func (r *Repository) ListEnabledByPosition(position string) ([]Advertisement, error) {
	rows, err := r.db.Query(
		`SELECT id, title, image_url, link_url, position, enabled, sort_order, created_by, created_at, updated_at
		 FROM advertisements WHERE enabled=1 AND position=? ORDER BY sort_order ASC, created_at DESC`,
		position,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Advertisement
	for rows.Next() {
		a, err := scanAd(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *a)
	}
	return out, rows.Err()
}

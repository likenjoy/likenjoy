package ad

import (
	"errors"
	"time"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

var ErrInvalidAd = errors.New("invalid advertisement: title required")

// Create 新增广告（管理后台）
func (s *Service) Create(title, imageURL, linkURL, position string, enabled bool, sortOrder int, createdBy string) (*Advertisement, error) {
	if title == "" {
		return nil, ErrInvalidAd
	}
	if position == "" {
		position = "home_banner"
	}
	a := &Advertisement{
		ID:        NewID(),
		Title:     title,
		ImageURL:  imageURL,
		LinkURL:   linkURL,
		Position:  position,
		Enabled:   enabled,
		SortOrder: sortOrder,
		CreatedBy: createdBy,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.repo.Create(a); err != nil {
		return nil, err
	}
	return a, nil
}

// Update 更新广告
func (s *Service) Update(id, title, imageURL, linkURL, position string, enabled bool, sortOrder int) (*Advertisement, error) {
	if title == "" {
		return nil, ErrInvalidAd
	}
	a := &Advertisement{
		ID:        id,
		Title:     title,
		ImageURL:  imageURL,
		LinkURL:   linkURL,
		Position:  position,
		Enabled:   enabled,
		SortOrder: sortOrder,
		UpdatedAt: time.Now(),
	}
	if err := s.repo.Update(a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) Delete(id string) error { return s.repo.Delete(id) }

// List 管理后台：全部广告
func (s *Service) List() ([]Advertisement, error) { return s.repo.List() }

// ListEnabled 公开：指定广告位的启用广告
func (s *Service) ListEnabled(position string) ([]Advertisement, error) {
	return s.repo.ListEnabledByPosition(position)
}

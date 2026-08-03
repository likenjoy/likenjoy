package user

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailTaken    = errors.New("email already registered")
	ErrInvalidCreds  = errors.New("invalid email or password")
	ErrUserNotFound  = errors.New("user not found")
	ErrUserNotActive = errors.New("user account is not active")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Register(email, password, phone string, role UserRole) (*User, error) {
	existing, _ := s.repo.FindByEmail(email)
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	u := &User{
		Email:        email,
		PasswordHash: string(hash),
		Phone:        phone,
		Role:         role,
		Status:       StatusActive,
	}
	if err := s.repo.Create(u); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

func (s *Service) Authenticate(email, password string) (*User, error) {
	u, err := s.repo.FindByEmail(email)
	if err != nil {
		return nil, ErrInvalidCreds
	}
	if u.Status != StatusActive {
		return nil, ErrUserNotActive
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCreds
	}
	return u, nil
}

func (s *Service) GetByID(id uuid.UUID) (*User, error) {
	return s.repo.FindByID(id)
}

func (s *Service) BindWallet(userID, walletAddress string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("parse user id: %w", err)
	}
	return s.repo.BindWallet(uid, walletAddress)
}

func (s *Service) GetByIDString(userID string) (*User, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("parse user id: %w", err)
	}
	return s.repo.FindByID(uid)
}

func (s *Service) Activate(id uuid.UUID) error {
	return s.repo.UpdateStatus(id, StatusActive)
}

func (s *Service) Suspend(id uuid.UUID) error {
	return s.repo.UpdateStatus(id, StatusSuspended)
}

// ListAllAdmin 管理后台用户列表
func (s *Service) ListAllAdmin(limit, offset int) ([]UserAdminView, int64, error) {
	return s.repo.ListAllAdmin(limit, offset)
}

/**
 * components/UIKit.js
 * Reusable modern UI components following ride-sharing aesthetic
 */

import React from "react";
import { THEME, BUTTON_STYLES, CARD_STYLES, flexCenter } from "../theme";

// ─── Button Component ───────────────────────────────
export const Button = ({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
  style = {},
  className = "",
  ...props
}) => {
  const baseStyle = {
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "14px 24px" : "10px 20px",
    borderRadius: THEME.borderRadius.md,
    fontSize: size === "sm" ? THEME.typography.sizes.small : THEME.typography.sizes.body,
    fontFamily: THEME.typography.fontFamily,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    ...(BUTTON_STYLES[variant] || BUTTON_STYLES.primary),
    ...style,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      style={baseStyle}
      {...props}
    >
      {loading ? "Loading..." : children}
    </button>
  );
};

// ─── Card Component ───────────────────────────────
export const Card = ({
  children,
  variant = "default",
  onClick,
  style = {},
  className = "",
  ...props
}) => {
  const baseStyle = {
    ...(CARD_STYLES[variant] || CARD_STYLES.default),
    ...(onClick && { cursor: "pointer" }),
    ...style,
  };

  return (
    <div
      className={className}
      style={baseStyle}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

// ─── Input Component ───────────────────────────────
export const Input = ({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  disabled = false,
  error,
  icon,
  style = {},
  ...props
}) => {
  return (
    <div style={{ marginBottom: THEME.spacing.md }}>
      {label && (
        <label style={{
          display: "block",
          fontSize: THEME.typography.sizes.small,
          fontWeight: THEME.typography.weights.semibold,
          marginBottom: THEME.spacing.sm,
          color: THEME.colors.textPrimary,
        }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{
            width: "100%",
            padding: `${THEME.spacing.sm} ${THEME.spacing.md}`,
            border: `1px solid ${error ? THEME.colors.danger : THEME.colors.border}`,
            borderRadius: THEME.borderRadius.md,
            fontSize: THEME.typography.sizes.body,
            fontFamily: THEME.typography.fontFamily,
            boxSizing: "border-box",
            transition: THEME.transitions.fast,
            backgroundColor: disabled ? THEME.colors.bgTertiary : THEME.colors.bgPrimary,
            color: THEME.colors.textPrimary,
            ...style,
          }}
          {...props}
        />
        {icon && (
          <span style={{
            position: "absolute",
            right: THEME.spacing.md,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "18px",
          }}>
            {icon}
          </span>
        )}
      </div>
      {error && (
        <span style={{
          fontSize: THEME.typography.sizes.small,
          color: THEME.colors.danger,
          marginTop: THEME.spacing.sm,
          display: "block",
        }}>
          {error}
        </span>
      )}
    </div>
  );
};

// ─── Badge Component ───────────────────────────────
export const Badge = ({
  children,
  variant = "primary",
  style = {},
}) => {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${THEME.spacing.xs} ${THEME.spacing.sm}`,
    borderRadius: THEME.borderRadius.full,
    fontSize: THEME.typography.sizes.xs,
    fontWeight: THEME.typography.weights.semibold,
    backgroundColor: variant === "primary" ? THEME.colors.primary : THEME.colors.secondary,
    color: THEME.colors.textInverse,
    ...style,
  };

  return <span style={baseStyle}>{children}</span>;
};

// ─── Alert Component ───────────────────────────────
export const Alert = ({
  type = "info",
  title,
  message,
  onClose,
  style = {},
}) => {
  const bgColor = {
    success: "rgba(29, 185, 84, 0.1)",
    error: "rgba(231, 76, 60, 0.1)",
    warning: "rgba(255, 193, 7, 0.1)",
    info: "rgba(0, 153, 255, 0.1)",
  }[type];

  const borderColor = {
    success: THEME.colors.success,
    error: THEME.colors.danger,
    warning: THEME.colors.warning,
    info: THEME.colors.info,
  }[type];

  return (
    <div style={{
      backgroundColor: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: THEME.borderRadius.md,
      padding: THEME.spacing.md,
      marginBottom: THEME.spacing.md,
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: THEME.typography.sizes.h6,
          fontWeight: THEME.typography.weights.semibold,
          marginBottom: THEME.spacing.xs,
          color: THEME.colors.textPrimary,
        }}>
          {title}
        </div>
      )}
      <div style={{
        fontSize: THEME.typography.sizes.body,
        color: THEME.colors.textSecondary,
      }}>
        {message}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            marginTop: THEME.spacing.sm,
            background: "none",
            border: "none",
            color: borderColor,
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: THEME.typography.weights.semibold,
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

// ─── Loading Spinner ───────────────────────────────
export const Spinner = ({ size = 40, color = THEME.colors.primary }) => (
  <div style={{
    ...flexCenter,
    width: size,
    height: size,
  }}>
    <div style={{
      width: size,
      height: size,
      border: `4px solid ${color}33`,
      borderTop: `4px solid ${color}`,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      "@keyframes spin": {
        "0%": { transform: "rotate(0deg)" },
        "100%": { transform: "rotate(360deg)" },
      },
    }} />
  </div>
);

// ─── Modal Component ───────────────────────────────
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = "md",
}) => {
  if (!isOpen) return null;

  const maxWidth = {
    sm: "400px",
    md: "600px",
    lg: "800px",
  }[size];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: THEME.zIndex.modal,
    }}>
      <div style={{
        backgroundColor: THEME.colors.bgPrimary,
        borderRadius: THEME.borderRadius.lg,
        maxWidth: maxWidth,
        width: "90vw",
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: THEME.shadows.xxl,
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: THEME.spacing.lg,
          borderBottom: `1px solid ${THEME.colors.border}`,
        }}>
          <h2 style={{
            fontSize: THEME.typography.sizes.h4,
            fontWeight: THEME.typography.weights.bold,
            margin: 0,
            color: THEME.colors.textPrimary,
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: THEME.colors.textSecondary,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: THEME.spacing.lg }}>
          {children}
        </div>

        {/* Footer Actions */}
        {actions && (
          <div style={{
            display: "flex",
            gap: THEME.spacing.md,
            padding: THEME.spacing.lg,
            borderTop: `1px solid ${THEME.colors.border}`,
            justifyContent: "flex-end",
          }}>
            {actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || "secondary"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Toast/Notification Component ───────────────────────────────
export const Toast = ({ message, type = "info", duration = 3000, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: THEME.colors.success,
    error: THEME.colors.danger,
    warning: THEME.colors.warning,
    info: THEME.colors.info,
  }[type];

  return (
    <div style={{
      position: "fixed",
      bottom: THEME.spacing.lg,
      right: THEME.spacing.lg,
      backgroundColor: bgColor,
      color: THEME.colors.textInverse,
      padding: THEME.spacing.md,
      borderRadius: THEME.borderRadius.md,
      boxShadow: THEME.shadows.lg,
      zIndex: THEME.zIndex.tooltip,
      animation: `slideInUp 0.3s ${THEME.transitions.normal}`,
      maxWidth: "400px",
    }}>
      {message}
    </div>
  );
};

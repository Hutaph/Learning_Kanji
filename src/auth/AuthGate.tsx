import { FormEvent, useMemo, useState } from "react";
import { hasSupabaseEnv, supabase } from "../lib/supabaseClient";

type AuthMode = "signin" | "signup";

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submitLabel = useMemo(() => {
    if (busy) {
      return "Đang xử lý...";
    }
    return mode === "signin" ? "Đăng nhập" : "Tạo tài khoản";
  }, [busy, mode]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!supabase) {
      setError("Thiếu cấu hình Supabase. Vui lòng thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!identifier.trim() || !password.trim()) {
      setError("Vui lòng nhập tên đăng nhập/email và mật khẩu.");
      return;
    }
    const normalizedIdentifier = identifier.trim();
    const looksLikeEmail = normalizedIdentifier.includes("@");
    if (mode === "signup") {
      const trimmedUsername = username.trim();
      if (!looksLikeEmail) {
        setError("Khi đăng ký, trường đăng nhập phải là email hợp lệ.");
        return;
      }
      if (!trimmedUsername) {
        setError("Vui lòng nhập tên đăng nhập.");
        return;
      }
      if (!/^[a-zA-Z0-9_.]{3,24}$/.test(trimmedUsername)) {
        setError("Tên đăng nhập gồm 3-24 ký tự: chữ, số, dấu gạch dưới hoặc chấm.");
        return;
      }
      if (password.length < 8) {
        setError("Mật khẩu phải có ít nhất 8 ký tự.");
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError("Mật khẩu cần có ít nhất 1 chữ cái và 1 chữ số.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Mật khẩu nhập lại không khớp.");
        return;
      }
      const { data: existingUsername, error: existingUsernameError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", trimmedUsername.toLowerCase())
        .maybeSingle();
      if (existingUsernameError) {
        setError(existingUsernameError.message);
        return;
      }
      if (existingUsername?.user_id) {
        setError("Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.");
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        let emailToSignIn = normalizedIdentifier;
        if (!looksLikeEmail) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email")
            .eq("username", normalizedIdentifier.toLowerCase())
            .maybeSingle();
          if (profileError) {
            throw profileError;
          }
          if (!profile?.email) {
            throw new Error("Không tìm thấy tên đăng nhập.");
          }
          emailToSignIn = profile.email;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToSignIn,
          password
        });
        if (signInError) {
          throw signInError;
        }
      } else {
        const signupEmail = normalizedIdentifier.toLowerCase();
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: signupEmail,
          password,
          options: {
            data: {
              username: username.trim().toLowerCase()
            }
          }
        });
        if (signUpError) {
          throw signUpError;
        }
        const usernameLower = username.trim().toLowerCase();
        const userId = signUpData.user?.id;
        if (userId) {
          const { error: profileUpsertError } = await supabase.from("profiles").upsert(
            {
              user_id: userId,
              username: usernameLower,
              email: signupEmail,
              updated_at: new Date().toISOString()
            },
            { onConflict: "user_id" }
          );
          if (profileUpsertError) {
            throw profileUpsertError;
          }
        }
        localStorage.setItem("auth-just-signed-up", "1");
        setNotice("Đăng ký thành công. Nếu Supabase bật xác minh email, hãy kiểm tra hộp thư trước khi đăng nhập.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xác thực lúc này.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="appShell layoutCompact">
      <div className="container">
        <section className="card authCard">
          <p className="authBadge">KULUKULU NIHONGO</p>
          <h2 className="authTitle">Đăng nhập tài khoản học tập</h2>
          <p className="muted authSubtitle">Lưu toàn bộ tiến độ và tiếp tục học trên mọi thiết bị của bạn.</p>
          {!hasSupabaseEnv ? (
            <div className="error">
              Chưa cấu hình Supabase. Hãy tạo file <code>.env</code> từ <code>.env.example</code>.
            </div>
          ) : null}
          {error ? <div className="error">{error}</div> : null}
          {notice ? <div className="notice">{notice}</div> : null}

          <div className="authTabs" role="tablist" aria-label="Chọn chế độ tài khoản">
            <button
              type="button"
              className={`jlptSegBtn ${mode === "signin" ? "isOn" : ""}`}
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError("");
                setNotice("");
                setIdentifier("");
                setPassword("");
                setConfirmPassword("");
              }}
              disabled={busy}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={`jlptSegBtn ${mode === "signup" ? "isOn" : ""}`}
              role="tab"
              aria-selected={mode === "signup"}
              onClick={() => {
                setMode("signup");
                setError("");
                setNotice("");
                setIdentifier("");
                setPassword("");
                setConfirmPassword("");
              }}
              disabled={busy}
            >
              Đăng ký
            </button>
          </div>

          <form className="authForm" onSubmit={onSubmit}>
            {mode === "signup" ? (
              <label>
                Tên đăng nhập
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="vd: huynh_nihongo"
                />
              </label>
            ) : null}
            <label>
              {mode === "signin" ? "Tên đăng nhập hoặc Email" : "Email"}
              <input
                type={mode === "signin" ? "text" : "email"}
                autoComplete={mode === "signin" ? "username" : "email"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "signin" ? "vd: huynh_nihongo hoặc you@example.com" : "you@example.com"}
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
              />
            </label>
            {mode === "signup" ? (
              <label>
                Nhập lại mật khẩu
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                />
              </label>
            ) : null}
            {mode === "signup" ? (
              <p className="hint">Mật khẩu cần ít nhất 8 ký tự, gồm chữ cái và chữ số.</p>
            ) : null}
            <button type="submit" className="btnPrimary authSubmitBtn" disabled={busy || !hasSupabaseEnv}>
              {submitLabel}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

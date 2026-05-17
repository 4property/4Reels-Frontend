import { Cover } from '../../shared/Cover.jsx';
import { Icon } from '../../shared/Icon.jsx';
import { Toggle } from '../../shared/Toggle.jsx';
import { EmailListInput } from './EmailListInput.jsx';

export function ReviewModeDetails({ reviewEmails, setReviewEmails, quietHours, setQuietHours }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title auto-title-with-icon">
            <span className="auto-title-chip warning">
              <Icon name="bell" size={12} />
            </span>
            Review-first details
          </div>
          <div className="card-subtitle">Who gets notified, and how the review email works.</div>
        </div>
      </div>
      <div className="card-body stack" style={{ gap: 18 }}>
        <div className="field">
          <label className="label" htmlFor="review-emails-input">Send review email to</label>
          <EmailListInput
            id="review-emails-input"
            value={reviewEmails}
            onChange={setReviewEmails}
          />
          <div className="hint">
            Press Enter, comma or space to add. Each recipient gets their own 1-click approve link.
          </div>
        </div>

        <hr className="sep" style={{ margin: 0 }} />

        <div>
          <div className="label" style={{ marginBottom: 8 }}>Preview of the review email</div>
          <EmailPreview />
        </div>

        <hr className="sep" style={{ margin: 0 }} />
        <Toggle
          on={quietHours}
          onChange={setQuietHours}
          label="Don't send review emails during quiet hours"
          sub="Emails queued between 22:00 and 07:00 are delivered at 07:00."
        />
      </div>
    </div>
  );
}

function EmailPreview() {
  return (
    <div className="email-preview">
      <div className="email-preview-head">
        <div className="email-preview-logo">4</div>
        <div className="grow">
          <div className="email-preview-title">A new reel is ready for your review</div>
          <div className="email-preview-from">from 4reels · noreply@4reels.app</div>
        </div>
      </div>
      <div className="email-preview-body">
        <div className="email-preview-thumb">
          <Cover kind="cranford-primary" ratio="3/4" video />
        </div>
        <div className="min-w-0">
          <div className="t-semibold" style={{ color: 'var(--text)', marginBottom: 2 }}>
            Cranford Court · 2-bed · €385,000
          </div>
          <div className="t-muted" style={{ marginBottom: 10 }}>
            Ready to post to Instagram, TikTok, Facebook, GMB
          </div>
          <div className="row gap-3 row-wrap">
            <span className="btn primary sm" style={{ pointerEvents: 'none' }}>✓ Approve &amp; publish</span>
            <span className="btn sm" style={{ pointerEvents: 'none' }}>Open editor</span>
            <span className="btn sm danger" style={{ pointerEvents: 'none' }}>Reject</span>
          </div>
        </div>
      </div>
    </div>
  );
}

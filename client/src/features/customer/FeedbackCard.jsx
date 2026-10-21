import { useRef, useState } from 'react';
import { Star, Heart } from 'lucide-react';
import { Button, Card, Chip, Stars, TextField, useToast } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { FEEDBACK_TAG_LABEL, RATING_LABEL, tagsForRating } from '../../lib/feedback';
import { useCustomer } from './CustomerContext';

// Five stars as a radio group: arrow keys move the choice, like native radios.
export function StarRating({ value, onChange, size = 36, label = 'Rating' }) {
  const refs = useRef([]);
  const move = (next) => {
    const rating = Math.min(5, Math.max(1, next));
    onChange(rating);
    refs.current[rating - 1]?.focus();
  };
  return (
    <div className="star-rating" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => { refs.current[n - 1] = el; }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}, ${RATING_LABEL[n]}`}
          tabIndex={value ? (value === n ? 0 : -1) : (n === 1 ? 0 : -1)}
          className={`star-button ${n <= (value || 0) ? 'is-on' : ''}`}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); move((value || 0) + 1); }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); move((value || 2) - 1); }
          }}
        >
          <Star size={size} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

// "How was your meal?" once the order is served; a thank-you with the stars afterwards.
export function FeedbackCard({ order }) {
  const { rateOrder } = useCustomer();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  if (order.feedback?.rating) {
    return (
      <Card className="feedback-card is-done" role="status">
        <Heart size={24} aria-hidden="true" />
        <div>
          <strong>Thanks for your feedback!</strong>
          <Stars rating={order.feedback.rating} />
        </div>
      </Card>
    );
  }

  const choose = (value) => {
    setRating(value);
    const allowed = tagsForRating(value);
    setTags((list) => list.filter((t) => allowed.includes(t)));
  };
  const toggle = (tag) => setTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  const send = async () => {
    setSending(true);
    try {
      await rateOrder(order._id, { rating, tags, comment: comment.trim() || undefined });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not send your rating'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="feedback-card">
      <h2 className="card-title">How was your meal?</h2>
      <StarRating value={rating} onChange={choose} label="Rate your meal" />
      <p className="feedback-label muted text-sm" aria-live="polite">{rating ? RATING_LABEL[rating] : 'Tap a star'}</p>
      {rating > 0 && (
        <>
          <div className="chip-row feedback-tags" role="group" aria-label={rating >= 4 ? 'What did you like?' : 'What went wrong?'}>
            {tagsForRating(rating).map((tag) => <Chip key={tag} active={tags.includes(tag)} onClick={() => toggle(tag)}>{FEEDBACK_TAG_LABEL[tag]}</Chip>)}
          </div>
          <TextField label="Anything else? (optional)" multiline rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button block onClick={send} loading={sending}>Send feedback</Button>
        </>
      )}
    </Card>
  );
}

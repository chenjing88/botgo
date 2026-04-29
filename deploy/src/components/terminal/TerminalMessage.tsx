import { useNavigate } from 'react-router-dom';

interface TerminalMessageProps {
  post: any;
  mode?: 'card' | 'detail';
}

export default function TerminalMessage({ post, mode = 'card' }: TerminalMessageProps) {
  const navigate = useNavigate();

  const timeStr    = post.time || '00:00:00';
  const authorName = post.author?.name || 'UNKNOWN';
  const authorHandle = post.author?.handle || '@unknown';
  const content    = post.content || '';
  const sourceTitle = post.source?.title || '';
  const sourceName  = post.source?.name || '';
  const stats      = post.stats || {};
  const replies    = stats.replies || 0;
  const previewComments = post.previewComments || [];

  const isSilicon = post.author?.userType === 'silicon';
  const nameColor = isSilicon ? 'text-primary-fixed-dim' : 'text-tertiary-fixed-dim';

  const isCard = mode === 'card';

  return (
    <div className={`fade-in ${isCard ? 'p-5' : 'p-6'}`}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className={`${nameColor} font-bold text-body-sm tracking-tight`}>
          [{authorName}]
        </span>

        <span className={`tag-bracket ${isSilicon ? 'tag-silicon' : 'tag-carbon'}`}>
          {isSilicon ? 'SI' : 'C'}
        </span>

        <span className="text-body-sm text-on-surface-variant/45 font-code-md">
          {authorHandle}
        </span>

        <span className="text-body-sm text-on-surface-variant/35 font-code-md ml-auto shrink-0">
          {timeStr}
        </span>
      </div>

      <div className="ml-1">
        <p className="text-code-md text-primary leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>

        {(sourceTitle || sourceName) && (
          <div className="mt-3">
            <span className="text-body-sm text-on-surface-variant/55 tracking-wide">
              &lt; SOURCE: {sourceName}{sourceTitle ? ` · ${sourceTitle}` : ''} &gt;
            </span>
          </div>
        )}

        {isCard && previewComments.length > 0 && (
          <div className="mt-4 space-y-2">
            {previewComments.slice(0, 2).map((comment: any) => (
              <div key={comment.id} className="text-on-surface-variant/60 text-body-sm pl-3">
                <span className={`font-bold text-body-sm ${comment.author?.userType === 'silicon' ? 'text-primary-fixed-dim/70' : 'text-tertiary-fixed-dim/70'}`}>
                  [{comment.author?.name || '???'}]
                </span>
                <span className="text-on-surface-variant/40 ml-1">{comment.content?.substring(0, 80)}{comment.content?.length > 80 ? '...' : ''}</span>
              </div>
            ))}
          </div>
        )}

        {isCard && (
          <div className="mt-2 text-body-sm text-on-surface-variant/30">
            └─ {replies} thread{replies !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

/*
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Page,
    Card,
    CardBody,
    Button,
    Spinner,
    PageErrorCard,
    addPageError,
    type PageErrors,
    ReloadButton,
    Text,
    AgentDidName,
} from '@/components';
import Modal from '@/components/Modal';
import { useAccountStore } from '@/stores';
import {
    deleteAgentChat,
    continueAgentChat,
    fetchAgentChatDetail,
    type AgentChatDetailPayload,
    type AgentChatMessage,
} from '@/net/serverApi';
import { agentMessageLabelFromParts } from '@/utils/agentChatLabels';
import { fetchDidDocumentNameForBaseDid } from '@/utils/fetchDidDocumentName';
import { parseDid } from '@agentic-profile/common';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

function formatWhen(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
}

/** Compact date/time for a chat line (bottom of bubble). *
function formatMessageTime(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function messageBody(m: AgentChatMessage): string {
    return (m.parts ?? [])
        .map((p) => (typeof p.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n');
}

// A2A: ROLE_USER = 1, ROLE_AGENT = 2 (string or numeric from API)
function isRoleUser(role: string | number): boolean {
    const r = String(role);
    return r === 'ROLE_USER' || r === '1';
}

function isRoleAgent(role: string | number): boolean {
    const r = String(role);
    return r === 'ROLE_AGENT' || r === '2';
}

function messageTimestamp(m: AgentChatMessage): string | undefined {
    const raw = m.metadata?.timestamp;
    return typeof raw === 'string' ? raw : undefined;
}

export default function AgentChatsDetailPage() {
    const { account } = useAccountStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const agentDid = searchParams.get('agentDid') ?? '';
    const peerDid = searchParams.get('peerDid') ?? '';

    const [chat, setChat] = useState<AgentChatDetailPayload | null>(null);
    const [loading, setLoading] = useState(false);
    const [continueAction, setContinueAction] = useState<'continue' | 'restart' | null>(null);
    const [pageErrors, setPageErrors] = useState<PageErrors>({});
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [didNameByBaseDid, setDidNameByBaseDid] = useState<Record<string, string | undefined>>({});
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const load = useCallback(async () => {
        if (!account || !agentDid || !peerDid) return;
        setLoading(true);
        try {
            setPageErrors({});
            const [detailResult] = await fetchAgentChatDetail(agentDid, peerDid);
            if (detailResult?.chat) setChat(detailResult.chat);
            else setChat(null);
        } catch (err) {
            addPageError(setPageErrors, 'detail', err, ['Failed to load chat']);
            setChat(null);
        } finally {
            setLoading(false);
        }
    }, [account, agentDid, peerDid]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        bottomRef.current?.scrollIntoView({ block: 'end', behavior });
    }, []);

    const performContinue = useCallback(async (options?: { scrollToBottom?: boolean; rewind?: boolean }) => {
        if (!agentDid || !peerDid) return;
        const action: 'continue' | 'restart' = options?.rewind ? 'restart' : 'continue';
        setContinueAction(action);
        setPageErrors({});
        const shouldScroll = options?.scrollToBottom ?? true;
        if (shouldScroll)
            scrollToBottom('smooth');
        const rewind = options?.rewind ? true : undefined;
        try {
            const [result] = await continueAgentChat(agentDid, peerDid, {
                posthaste: true,
                rewind,
            });
            const newMessages = result?.messages ?? [];
            if (newMessages.length > 0) {
                setChat((prev) => {
                    if (!prev) return prev;
                    let nextAgentResolution = options?.rewind ? undefined : prev.agentResolution;
                    let nextPeerResolution = options?.rewind ? undefined : prev.peerResolution;
                    for (const m of newMessages) {
                        const resolution = m?.metadata?.resolution;
                        if (typeof resolution !== 'object' || resolution === null) continue;
                        const r = resolution as Record<string, unknown>;
                        if (isRoleAgent(m.role)) nextAgentResolution = r;
                        else if (isRoleUser(m.role)) nextPeerResolution = r;
                    }
                    return {
                        ...prev,
                        messages: options?.rewind ? [...newMessages] : [...(prev.messages ?? []), ...newMessages],
                        agentResolution: nextAgentResolution,
                        peerResolution: nextPeerResolution,
                    };
                });
            }
            if (shouldScroll) {
                // Ensure we land on the newly added messages.
                requestAnimationFrame(() => scrollToBottom('smooth'));
            }
        } catch (err) {
            addPageError(setPageErrors, 'continue', err, ['Failed to continue chat']);
        } finally {
            setContinueAction(null);
        }
    }, [agentDid, peerDid, scrollToBottom]);

    const continuing = continueAction !== null;

    useEffect(() => {
        if (account && agentDid && peerDid) {
            void load();
        } else {
            setChat(null);
        }
    }, [account, agentDid, peerDid, load]);

    useEffect(() => {
        if (!chat) {
            setDidNameByBaseDid({});
            return;
        }
        const bases = new Set<string>();
        for (const d of [chat.agentDid, chat.peerDid]) {
            const b = parseDid(d).did;
            if (b)
                bases.add(b);
        }
        let cancelled = false;
        void (async () => {
            const entries = await Promise.all(
                [...bases].map(async (base) => {
                    const name = await fetchDidDocumentNameForBaseDid(base);
                    return [base, name] as const;
                }),
            );
            if (!cancelled)
                setDidNameByBaseDid(Object.fromEntries(entries));
        })();
        return () => {
            cancelled = true;
        };
    }, [chat]);

    const performDelete = useCallback(async () => {
        if (!agentDid || !peerDid)
            return;
        setDeleting(true);
        setPageErrors({});
        try {
            const [, res] = await deleteAgentChat(agentDid, peerDid);
            if (res?.ok) {
                setShowDeleteModal(false);
                navigate('/agents/chats');
            }
        } catch (err) {
            addPageError(setPageErrors, 'delete', err, ['Failed to delete chat']);
        } finally {
            setDeleting(false);
        }
    }, [agentDid, peerDid, navigate]);

    const { myMessageLabel, peerMessageLabel } = useMemo(() => {
        if (!chat) return { myMessageLabel: '', peerMessageLabel: '' };
        const nameForDid = (fullDid: string) => {
            const b = parseDid(fullDid).did;
            return b ? didNameByBaseDid[b] : undefined;
        };
        return {
            myMessageLabel: agentMessageLabelFromParts(nameForDid(chat.agentDid), chat.agentDid),
            peerMessageLabel: agentMessageLabelFromParts(nameForDid(chat.peerDid), chat.peerDid),
        };
    }, [chat, didNameByBaseDid]);

    const agentLiked = useMemo(() => {
        if (!chat?.agentResolution) return false;
        return (chat.agentResolution as Record<string, unknown>)?.like === true;
    }, [chat?.agentResolution]);

    const peerLiked = useMemo(() => {
        if (!chat?.peerResolution) return false;
        return (chat.peerResolution as Record<string, unknown>)?.like === true;
    }, [chat?.peerResolution]);

    if (!account) {
        return (
            <Page title="Agent Chat Details">
                <Card>
                    <CardBody className="py-12 text-center">
                        <Text size="md" className="text-gray-500 dark:text-gray-400 mb-4">
                            Sign in to view this chat.
                        </Text>
                        <Link
                            to="/agents/linked"
                            className="inline-flex items-center justify-center font-medium rounded-md px-4 py-2 text-sm bg-dodgerblue hover:bg-blue-600 text-white"
                        >
                            Log in
                        </Link>
                    </CardBody>
                </Card>
            </Page>
        );
    }

    if (!agentDid || !peerDid) {
        return (
            <Page title="Agent Chat Details" subtitle="Missing agent or peer">
                <Card>
                    <CardBody className="py-8">
                        <Text className="text-gray-600 dark:text-gray-300 mb-4">
                            Open a chat from the agent chats list.
                        </Text>
                        <Link
                            to="/agents/chats"
                            className="inline-flex items-center justify-center font-medium rounded-md px-4 py-2 text-sm bg-dodgerblue hover:bg-blue-600 text-white border border-transparent"
                        >
                            Back to agent chats
                        </Link>
                    </CardBody>
                </Card>
            </Page>
        );
    }

    return (
        <Page title="Agent Chat Details" subtitle="Agent-to-agent (A2A) messages">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <Link
                    to="/agents/chats"
                    className="inline-flex items-center justify-center font-medium rounded-md px-3 py-1.5 text-sm bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                >
                    ← All chats
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                    <ReloadButton
                        onClick={() => void load()}
                        isReloading={loading}
                        ariaLabel="Reload chat"
                    />
                    {chat ? (
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => void performContinue({ scrollToBottom: false, rewind: true })}
                                loading={continueAction === 'restart'}
                                disabled={loading || deleting || continuing}
                            >
                                Restart Chat
                            </Button>
                            <Button
                                onClick={() => void performContinue({ scrollToBottom: false })}
                                loading={continueAction === 'continue'}
                                disabled={loading || deleting || continuing}
                            >
                                Continue Chat
                            </Button>
                        </>
                    ) : null}
                    {chat ? (
                        <Button
                            variant="danger"
                            onClick={() => setShowDeleteModal(true)}
                            disabled={loading || deleting || continuing}
                        >
                            Delete
                        </Button>
                    ) : null}
                </div>
            </div>

            {loading && !chat ? (
                <Card>
                    <CardBody className="flex justify-center py-12">
                        <Spinner />
                    </CardBody>
                </Card>
            ) : chat ? (
                <div className="space-y-6">
                    <Card>
                        <CardBody className="space-y-4 text-sm">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <AgentDidName
                                        did={chat.agentDid}
                                        primaryLabel={myMessageLabel}
                                        rightOfName={
                                            agentLiked ? (
                                                <StarSolidIcon
                                                    className="h-6 w-6 text-amber-500"
                                                    aria-label="Resolution: like"
                                                />
                                            ) : (
                                                <StarOutlineIcon
                                                    className="h-6 w-6 text-gray-400 dark:text-gray-500"
                                                    aria-label="Resolution: not like"
                                                />
                                            )
                                        }
                                    />
                                </div>
                                <div>
                                    <AgentDidName
                                        did={chat.peerDid}
                                        primaryLabel={peerMessageLabel}
                                        rightOfName={
                                            peerLiked ? (
                                                <StarSolidIcon
                                                    className="h-6 w-6 text-amber-500"
                                                    aria-label="Resolution: like"
                                                />
                                            ) : (
                                                <StarOutlineIcon
                                                    className="h-6 w-6 text-gray-400 dark:text-gray-500"
                                                    aria-label="Resolution: not like"
                                                />
                                            )
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <Text>
                                    <span className="text-gray-500 dark:text-gray-400">Created:</span>{' '}
                                    {formatWhen(chat.created)}
                                </Text>
                                <Text>
                                    <span className="text-gray-500 dark:text-gray-400">Updated:</span>{' '}
                                    {formatWhen(chat.updated)}
                                </Text>
                                <Text>
                                    <span className="text-gray-500 dark:text-gray-400">Messages:</span>{' '}
                                    {chat.messages?.length ?? 0}
                                </Text>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody className="space-y-4">
                            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Messages</h2>
                            {(chat.messages ?? []).length === 0 ? (
                                <Text className="text-gray-500 dark:text-gray-400">No messages recorded.</Text>
                            ) : (
                                <ul className="space-y-4 min-w-0">
                                    {(chat.messages ?? []).map((m, i) => {
                                        const user = isRoleUser(m.role);
                                        const agent = isRoleAgent(m.role);
                                        // ROLE_USER = left; ROLE_AGENT = right; unknown = left. 
                                        const alignRight = agent;
                                        const label =
                                            !user && !agent
                                                ? `Role ${String(m.role)}`
                                                : user
                                                  ? peerMessageLabel
                                                  : myMessageLabel;
                                        const body = messageBody(m);
                                        const ts = formatMessageTime(messageTimestamp(m));
                                        return (
                                            <li
                                                key={i}
                                                className={clsx(
                                                    'flex w-full min-w-0',
                                                    alignRight ? 'justify-end' : 'justify-start',
                                                )}
                                            >
                                                <div className="w-4/5 max-w-[80%] min-w-0 flex flex-col gap-1">
                                                    <Text
                                                        size="sm"
                                                        className={clsx(
                                                            'text-gray-600 dark:text-gray-300',
                                                            alignRight ? 'text-right' : 'text-left',
                                                        )}
                                                    >
                                                        {label}
                                                    </Text>
                                                    <div
                                                        className={clsx(
                                                            'rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 border',
                                                            user
                                                                ? 'bg-sky-100 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800'
                                                                : agent
                                                                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                                                                  : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-600',
                                                        )}
                                                    >
                                                        <div className="whitespace-pre-wrap break-words">
                                                            {body || '(empty message)'}
                                                        </div>
                                                        {ts ? (
                                                            <div
                                                                className={clsx(
                                                                    'text-[11px] leading-tight text-gray-500 dark:text-gray-400 mt-2',
                                                                    alignRight ? 'text-right' : 'text-left',
                                                                )}
                                                            >
                                                                {ts}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    {m.metadata && Object.keys(m.metadata).length > 0 ? (
                                                        <details
                                                            className={clsx(
                                                                'text-xs text-gray-500 dark:text-gray-400',
                                                                alignRight ? 'text-right' : 'text-left',
                                                            )}
                                                        >
                                                            <summary className="cursor-pointer select-none inline-block">
                                                                Metadata
                                                            </summary>
                                                            <pre className="mt-1 p-2 bg-slate-50 dark:bg-slate-900/50 rounded overflow-x-auto text-left">
                                                                {JSON.stringify(m.metadata, null, 2)}
                                                            </pre>
                                                        </details>
                                                    ) : null}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                            <div ref={bottomRef} />
                            <div className="flex justify-end pt-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={() => void performContinue({ scrollToBottom: true, rewind: true })}
                                        loading={continueAction === 'restart'}
                                        disabled={loading || deleting || continuing}
                                    >
                                        Restart Chat
                                    </Button>
                                    <Button
                                        onClick={() => void performContinue({ scrollToBottom: true })}
                                        loading={continueAction === 'continue'}
                                        disabled={loading || deleting || continuing}
                                    >
                                        Continue Chat
                                    </Button>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            ) : (
                <Card>
                    <CardBody className="py-8 text-center text-gray-500 dark:text-gray-400">
                        Chat not found or you do not have access.
                    </CardBody>
                </Card>
            )}

            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    if (!deleting)
                        setShowDeleteModal(false);
                }}
                title="Delete this chat?"
                maxWidth="max-w-md"
                showCloseButton={false}
            >
                <Text size="sm" className="mb-6">
                    Permanently remove this conversation and its messages from your account. This cannot be undone.
                </Text>
                <div className="flex flex-wrap justify-end gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => setShowDeleteModal(false)}
                        disabled={deleting}
                    >
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={() => void performDelete()} loading={deleting}>
                        Delete
                    </Button>
                </div>
            </Modal>

            <PageErrorCard pageErrors={pageErrors} setPageErrors={setPageErrors} name="detail" />
            <PageErrorCard pageErrors={pageErrors} setPageErrors={setPageErrors} name="delete" />
            <PageErrorCard pageErrors={pageErrors} setPageErrors={setPageErrors} name="continue" />
        </Page>
    );
} 
*/

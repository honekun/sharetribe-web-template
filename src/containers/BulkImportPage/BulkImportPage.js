import React, { useCallback, useEffect, useRef, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { isScrollingDisabled } from '../../ducks/ui.duck';
import { FormattedMessage, useIntl } from '../../util/reactIntl';

import { H1, LayoutSingleColumn, NamedLink, Page } from '../../components';

import FooterContainer from '../FooterContainer/FooterContainer';
import TopbarContainer from '../TopbarContainer/TopbarContainer';

import css from './BulkImportPage.module.css';

const STATUS_IDLE = 'idle';
const STATUS_UPLOADING = 'uploading';
const STATUS_PROCESSING = 'processing';
const STATUS_COMPLETED = 'completed';
const STATUS_ERROR = 'error';

const MAX_POLL_FAILURES = 5;

const ROW_ERROR_CODE_KEYS = {
  'image-invalid-content': 'BulkImportPage.rowError.imageInvalidContent',
  'user-not-found': 'BulkImportPage.rowError.userNotFound',
  'row-timeout': 'BulkImportPage.rowError.rowTimeout',
  'no-author': 'BulkImportPage.rowError.noAuthor',
  'placeholder-missing': 'BulkImportPage.rowError.placeholderUnavailable',
  'placeholder-invalid': 'BulkImportPage.rowError.placeholderUnavailable',
};

const HTTP_STATUS_KEYS = {
  400: 'BulkImportPage.rowError.http400',
  403: 'BulkImportPage.rowError.http403',
  409: 'BulkImportPage.rowError.http409',
  429: 'BulkImportPage.rowError.http429',
  500: 'BulkImportPage.rowError.http500',
};

const resolveRowErrorKey = error => {
  const codes = [...(error.sdkErrors || []).map(item => item.code), error.code].filter(Boolean);
  const knownCode = codes.find(code => ROW_ERROR_CODE_KEYS[code]);

  if (knownCode) return ROW_ERROR_CODE_KEYS[knownCode];
  if (error.status && HTTP_STATUS_KEYS[error.status]) return HTTP_STATUS_KEYS[error.status];
  return 'BulkImportPage.rowError.generic';
};

const rowErrorHint = error => {
  const hints = (error.sdkErrors || []).map(item =>
    item.source && Array.isArray(item.source.path)
      ? `${item.code} (${item.source.path.join('.')})`
      : item.code
  );

  if (hints.length === 0 && error.code) hints.push(error.code);
  if (hints.length === 0 && error.status) hints.push(`HTTP ${error.status}`);
  return hints.filter(Boolean).join(', ');
};

const TEMPLATE_URL = '/api/bulk-import/template';
const WHATSAPP_URL = 'https://wa.me/525531314247';

const ExternalArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M5 11 11 5M6 5h5v5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path
      d="M15.5 35.5h-2A8.5 8.5 0 0 1 12 18.64 12.5 12.5 0 0 1 36.26 22 7 7 0 0 1 36 36h-3.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m18 27 6-6 6 6M24 21v18"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="M26.5 15.4a10.4 10.4 0 0 1-15.35 9.15L6 26l1.4-5a10.4 10.4 0 1 1 19.1-5.6Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.05 10.6c.3-.65.62-.66.94-.67h.8c.24 0 .53.08.67.52.17.53.65 1.83.7 1.96.08.17.08.36-.02.56-.12.23-.35.5-.57.73-.2.2-.4.4-.17.78.25.38 1.03 1.57 2.45 2.78 1.7 1.44 3.02 1.9 3.45 2.1.42.2.67.17.94-.13.27-.3 1.12-1.28 1.42-1.72.3-.43.6-.35 1-.2.4.15 2.53 1.2 2.95 1.4.43.22.72.32.82.5.1.17.1 1-.23 1.98-.35.95-1.97 1.82-2.72 1.92-.7.1-1.65.15-2.68-.18-.62-.2-1.4-.45-2.4-.88-4.2-1.82-6.93-6.05-7.15-6.35-.2-.3-1.7-2.27-1.7-4.32 0-1.05.53-2.1 1.05-2.82Z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);

export const BulkImportPageComponent = props => {
  const { scrollingDisabled } = props;
  const intl = useIntl();

  const [actionToken, setActionToken] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState(STATUS_IDLE);
  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const pollRef = useRef(null);
  const pollFailuresRef = useRef(0);
  const fileInputRef = useRef(null);

  const requestActionToken = useCallback(async () => {
    const response = await fetch('/api/bulk-import/authorize', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || intl.formatMessage({ id: 'FileUpload.uploadFailed' }));
    }

    setActionToken(data.token);
    return data.token;
  }, [intl]);

  useEffect(() => {
    if (status !== STATUS_PROCESSING || !jobId || !actionToken) return undefined;

    pollFailuresRef.current = 0;

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const failPolling = messageId => {
      stopPolling();
      setUploadError(intl.formatMessage({ id: messageId }));
      setStatus(STATUS_ERROR);
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/bulk-import/status/${jobId}`, {
          credentials: 'include',
          headers: { 'X-Bulk-Import-Token': actionToken },
        });

        if (response.status === 404) {
          failPolling('BulkImportPage.errorJobUnavailable');
          return;
        }
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const data = await response.json();
        pollFailuresRef.current = 0;
        setJobData(data);

        if (data.status === 'completed' || data.status === 'failed') {
          setStatus(STATUS_COMPLETED);
          stopPolling();
        }
      } catch (error) {
        console.error('Poll error:', error);
        pollFailuresRef.current += 1;

        if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
          failPolling('BulkImportPage.errorStatusUnavailable');
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return stopPolling;
  }, [actionToken, intl, jobId, status]);

  const startImport = async file => {
    setCsvFile(file);
    setUploadError(null);
    setJobData(null);
    setStatus(STATUS_UPLOADING);

    const formData = new FormData();
    formData.append('zipFile', file);

    try {
      const token = await requestActionToken();
      const response = await fetch('/api/bulk-import/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Bulk-Import-Token': token },
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        const details = data.details ? `\n${data.details.join('\n')}` : '';
        const message = data.error || intl.formatMessage({ id: 'FileUpload.uploadFailed' });
        setUploadError(message + details);
        setStatus(STATUS_ERROR);
        return;
      }

      setJobId(data.jobId);
      setJobData({
        total: data.total,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
        results: [],
      });
      setStatus(STATUS_PROCESSING);
    } catch (error) {
      setUploadError(error.message || intl.formatMessage({ id: 'FileUpload.uploadFailed' }));
      setStatus(STATUS_ERROR);
    }
  };

  // A bare .csv is imported with placeholder photos; a .zip carries the CSV plus
  // its photos. The server tells them apart (classifyUpload) from the same field.
  const pickFile = file => {
    const name = file ? file.name.toLowerCase() : '';
    const isAccepted = name.endsWith('.csv') || name.endsWith('.zip');

    if (isAccepted) {
      startImport(file);
    } else if (file) {
      setCsvFile(null);
      setUploadError(intl.formatMessage({ id: 'BulkImportPage.simpleErrorNoCsv' }));
      setStatus(STATUS_ERROR);
    }
  };

  const handleDrop = event => {
    event.preventDefault();
    setIsDragging(false);
    pickFile(event.dataTransfer.files && event.dataTransfer.files[0]);
  };

  const handleReset = () => {
    setStatus(STATUS_IDLE);
    setJobId(null);
    setJobData(null);
    setUploadError(null);
    setCsvFile(null);
    setActionToken(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const progressPercent =
    jobData && jobData.total > 0 ? Math.round((jobData.processed / jobData.total) * 100) : 0;
  const title = intl.formatMessage({ id: 'BulkImportPage.title' });
  const showUploadView = status === STATUS_IDLE || status === STATUS_ERROR;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
        <main className={css.content}>
          {showUploadView ? (
            <>
              <header className={css.header}>
                <H1 as="h1" className={css.pageTitle}>
                  <FormattedMessage id="BulkImportPage.simpleHeading" />
                </H1>
                <p className={css.pageSubtitle}>
                  <FormattedMessage id="BulkImportPage.simpleDescription" />
                </p>
              </header>

              <ol className={css.steps}>
                <li className={css.step}>
                  <span className={css.stepNumber}>1.</span>
                  <div className={css.stepBody}>
                    <h2 className={css.stepTitle}>
                      <FormattedMessage id="BulkImportPage.simpleStep1Title" />
                    </h2>
                    <p className={css.stepText}>
                      <FormattedMessage id="BulkImportPage.simpleStep1Text" />
                    </p>
                    <a href={TEMPLATE_URL} className={css.templateButton} download>
                      <FormattedMessage id="BulkImportPage.simpleTemplateCta" />
                      <ExternalArrowIcon />
                    </a>
                  </div>
                </li>

                <li className={css.step}>
                  <span className={css.stepNumber}>2.</span>
                  <div className={css.stepBody}>
                    <h2 className={css.stepTitle}>
                      <FormattedMessage id="BulkImportPage.simpleStep2Title" />
                    </h2>
                    <p className={css.stepText}>
                      <FormattedMessage id="BulkImportPage.simpleStep2Text" />
                    </p>
                  </div>
                </li>

                <li className={css.step}>
                  <span className={css.stepNumber}>3.</span>
                  <div className={css.stepBody}>
                    <h2 className={css.stepTitle}>
                      <FormattedMessage id="BulkImportPage.simpleStep3Title" />
                    </h2>
                    <div
                      className={
                        isDragging ? `${css.dropzone} ${css.dropzoneActive}` : css.dropzone
                      }
                      onDragOver={event => {
                        event.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                    >
                      <span className={css.uploadIcon}>
                        <UploadIcon />
                      </span>
                      <p className={css.dropTitle}>
                        <FormattedMessage id="BulkImportPage.simpleDropTitle" />
                      </p>
                      <p className={css.dropSubtitle}>
                        <FormattedMessage id="BulkImportPage.simpleDropSubtitle" />
                      </p>
                      <button
                        type="button"
                        className={css.selectButton}
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      >
                        <FormattedMessage id="BulkImportPage.simpleSelectFile" />
                      </button>
                      <p className={css.fileHelp}>
                        {csvFile ? (
                          <FormattedMessage
                            id="BulkImportPage.zipSelected"
                            values={{ name: csvFile.name }}
                          />
                        ) : (
                          <FormattedMessage id="BulkImportPage.simpleFileHelp" />
                        )}
                      </p>
                      <label htmlFor="bulkImportCsv" className={css.visuallyHidden}>
                        <FormattedMessage id="BulkImportPage.simpleCsvLabel" />
                      </label>
                      <input
                        id="bulkImportCsv"
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.zip,text/csv,application/zip,application/x-zip-compressed"
                        className={css.visuallyHidden}
                        onChange={event => pickFile(event.target.files[0] || null)}
                      />
                    </div>

                    {uploadError && (
                      <div className={css.errorBox} role="alert">
                        <pre className={css.errorText}>{uploadError}</pre>
                      </div>
                    )}
                  </div>
                </li>
              </ol>

              <div className={css.helpRow}>
                <span className={css.whatsappIcon}>
                  <WhatsAppIcon />
                </span>
                <span className={css.helpText}>
                  <span>
                    <FormattedMessage id="BulkImportPage.helpTitle" />
                  </span>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    <FormattedMessage id="BulkImportPage.simpleWhatsappCta" />
                  </a>
                </span>
              </div>
            </>
          ) : (
            <div className={css.progressWrap}>
              {status === STATUS_UPLOADING && (
                <div className={css.statusBox}>
                  <p className={css.statusText}>
                    <FormattedMessage id="BulkImportPage.uploading" />
                  </p>
                </div>
              )}

              {(status === STATUS_PROCESSING || status === STATUS_COMPLETED) && jobData && (
                <div className={css.progressSection}>
                  <div className={css.progressBar}>
                    <div className={css.progressFill} style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className={css.progressText}>
                    <FormattedMessage
                      id="BulkImportPage.progress"
                      values={{
                        processed: jobData.processed,
                        total: jobData.total,
                        percent: progressPercent,
                      }}
                    />
                  </p>

                  <div className={css.summaryRow}>
                    <span className={css.successCount}>
                      <FormattedMessage
                        id="BulkImportPage.succeeded"
                        values={{ count: jobData.succeeded }}
                      />
                    </span>
                    <span className={css.errorCount}>
                      <FormattedMessage
                        id="BulkImportPage.failed"
                        values={{ count: jobData.failed }}
                      />
                    </span>
                  </div>

                  {status === STATUS_COMPLETED ? (
                    <p className={css.completedBadge}>
                      <FormattedMessage id="BulkImportPage.completed" />
                    </p>
                  ) : (
                    <p className={css.processingBadge}>
                      <FormattedMessage id="BulkImportPage.processing" />
                    </p>
                  )}

                  {jobData.errors.length > 0 && (
                    <div className={css.errorsSection}>
                      <h2 className={css.sectionTitle}>
                        <FormattedMessage id="BulkImportPage.errorsTitle" />
                      </h2>
                      <div className={css.tableWrap}>
                        <table className={css.table}>
                          <thead>
                            <tr>
                              <th>
                                <FormattedMessage id="BulkImportPage.tableRow" />
                              </th>
                              <th>
                                <FormattedMessage id="BulkImportPage.tableTitle" />
                              </th>
                              <th>
                                <FormattedMessage id="BulkImportPage.tableError" />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobData.errors.map((error, index) => (
                              <tr key={`${error.row}-${index}`}>
                                <td>{error.row}</td>
                                <td>{error.title}</td>
                                <td className={css.errorCell}>
                                  <div>{intl.formatMessage({ id: resolveRowErrorKey(error) })}</div>
                                  {rowErrorHint(error) && (
                                    <div className={css.errorCodeHint}>{rowErrorHint(error)}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {jobData.errorsWereCapped && (
                        <p className={css.errorsCappedNotice}>
                          <FormattedMessage id="BulkImportPage.errorsCapped" />
                        </p>
                      )}
                    </div>
                  )}

                  {status === STATUS_COMPLETED && (
                    <div className={css.completedActions}>
                      {jobData.failed === 0 && (
                        <NamedLink className={css.viewListingsLink} name="ManageListingsPage">
                          <FormattedMessage id="BulkImportPage.viewListings" />
                        </NamedLink>
                      )}
                      <button type="button" className={css.resetButton} onClick={handleReset}>
                        <FormattedMessage id="BulkImportPage.newImport" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => ({
  scrollingDisabled: isScrollingDisabled(state),
});

const BulkImportPage = compose(connect(mapStateToProps))(BulkImportPageComponent);

export default BulkImportPage;

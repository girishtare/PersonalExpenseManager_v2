export class StatementPasswordError extends Error {
  reason: 'password_required' | 'password_incorrect';

  constructor(reason: 'password_required' | 'password_incorrect') {
    super(
      reason === 'password_required'
        ? 'This PDF is password protected. Please provide the password.'
        : 'The password provided did not open this PDF. Please try again.'
    );
    this.name = 'StatementPasswordError';
    this.reason = reason;
  }
}

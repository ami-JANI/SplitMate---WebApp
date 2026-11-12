import { describe, expect, it } from 'vitest';
import { expenseProblem, hangoutProblem, identifierProblem, isEmail, signUpProblem } from './validator';

describe('signUpProblem', () => {
  it('reports the first problem in order', () => {
    expect(signUpProblem('', '', '', '')).toBe('Name is missing');
    expect(signUpProblem('Jani', '', '', '')).toBe('Username is missing');
    expect(signUpProblem('Jani', 'ja', '', '')).toBe('Username must be 3-20 characters');
    expect(signUpProblem('Jani', 'ja ni', '', '')).toBe('Use only letters, numbers, dots and underscores');
    expect(signUpProblem('Jani', 'jani', '', '')).toBe('Email is missing');
    expect(signUpProblem('Jani', 'jani', 'jani', '')).toBe("That email doesn't look right");
    expect(signUpProblem('Jani', 'jani', 'j@x.com', '')).toBe('Password is missing');
    expect(signUpProblem('Jani', 'jani', 'j@x.com', '12345')).toBe('Password needs at least 6 characters');
    expect(signUpProblem('Jani', 'Jani.E_1', 'j@x.com', '123456')).toBeNull();
  });
});

describe('emails', () => {
  it('accepts real addresses', () => {
    for (const ok of ['j@x.com', 'jani.e+split@gmail.com', 'a_b@mail.co.uk', ' Jani@Example.ORG ', 'x@sub-domain.example.io']) {
      expect(isEmail(ok), ok).toBe(true);
    }
  });
  it('rejects broken ones', () => {
    for (const bad of ['', 'jani', 'jani@', '@gmail.com', 'jani@gmail', 'jani@gmail.c', 'jani@@gmail.com', 'ja ni@gmail.com',
      'jani@gmail..com', 'jani@.gmail.com', 'jani@gmail.com.', '.jani@gmail.com', 'ja..ni@gmail.com', 'jani@-gmail.com', 'jani@gmail.c0m']) {
      expect(isEmail(bad), bad).toBe(false);
    }
  });
  it('sign-in takes an email or a username', () => {
    expect(identifierProblem('', 'x')).toBe('Email or username is missing');
    expect(identifierProblem('jani@gmail', 'x')).toBe("That email doesn't look right");
    expect(identifierProblem('jani@gmail.com', '')).toBe('Password is missing');
    expect(identifierProblem('@jani', 'x')).toBeNull();
    expect(identifierProblem('jani', 'x')).toBeNull();
    expect(identifierProblem('j!', 'x')).toBe("That username doesn't look right");
    expect(signUpProblem('Jani', 'jani', 'jani@gmail', '123456')).toBe("That email doesn't look right");
  });
});

describe('other checks', () => {
  it('hangouts and tours', () => {
    expect(hangoutProblem(' ', 'hangout', 1)).toBe('Give it a name');
    expect(hangoutProblem('Trip', 'tour', 1)).toBe('A tour lasts 2 to 30 days');
    expect(hangoutProblem('Trip', 'tour', 3)).toBeNull();
  });
  it('expenses', () => {
    expect(expenseProblem('', 100, 1)).toBe('Title is missing');
    expect(expenseProblem('Tea', undefined, 1)).toBe('Amount is missing');
    expect(expenseProblem('Tea', 0, 1)).toBe('Amount must be greater than zero');
    expect(expenseProblem('Tea', 100, 0)).toBe('Pick at least one person to split with');
  });
});

import { describe, expect, it } from 'vitest';
import { expenseProblem, hangoutProblem, signUpProblem } from './validator';

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

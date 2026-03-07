import {
  PAYER_PROFILES,
  getPayerProfile,
  listPayerProfiles,
  listPayerIds,
  type PayerProfile,
} from './index';

const EXPECTED_IDS = [
  'uhc-commercial',
  'aetna-commercial',
  'cigna-commercial',
  'anthem-bcbs',
  'medicare-advantage-humana',
];

describe('PAYER_PROFILES — all 5 profiles present', () => {
  it('has exactly 5 profiles', () => {
    expect(Object.keys(PAYER_PROFILES)).toHaveLength(5);
  });

  it.each(EXPECTED_IDS)('has profile "%s"', (id) => {
    expect(PAYER_PROFILES[id]).toBeDefined();
  });
});

describe('PayerProfile schema validation', () => {
  const validateProfile = (profile: PayerProfile) => {
    expect(profile.id).toBeTruthy();
    expect(profile.name).toBeTruthy();
    expect(profile.baseUrl).toMatch(/^https?:\/\//);
    expect(['smart', 'client_creds', 'none']).toContain(profile.authType);
    expect(profile.autoApproveRate).toBeGreaterThanOrEqual(0);
    expect(profile.autoApproveRate).toBeLessThanOrEqual(1);
    expect(profile.appealSuccessRate).toBeGreaterThanOrEqual(0);
    expect(profile.appealSuccessRate).toBeLessThanOrEqual(1);
    expect(profile.denialReasons.length).toBeGreaterThan(0);
    expect(profile.requiredDocumentation).toBeDefined();
    expect(typeof profile.requiresPeerToPeer).toBe('boolean');
  };

  it.each(EXPECTED_IDS)('profile "%s" has valid schema', (id) => {
    validateProfile(PAYER_PROFILES[id]);
  });
});

describe('denial reason probabilities', () => {
  it.each(EXPECTED_IDS)('"%s" denial reasons sum to ≤1', (id) => {
    const profile = PAYER_PROFILES[id];
    const sum = profile.denialReasons.reduce((acc, r) => acc + r.probability, 0);
    expect(sum).toBeLessThanOrEqual(1.01); // small float tolerance
  });

  it.each(EXPECTED_IDS)('"%s" all reason probabilities are positive', (id) => {
    const profile = PAYER_PROFILES[id];
    profile.denialReasons.forEach((r) => {
      expect(r.probability).toBeGreaterThan(0);
      expect(r.code).toBeTruthy();
      expect(r.description).toBeTruthy();
    });
  });
});

describe('getPayerProfile', () => {
  it('returns the correct profile by id', () => {
    const p = getPayerProfile('aetna-commercial');
    expect(p?.name).toBe('Aetna Commercial');
  });

  it('returns undefined for unknown id', () => {
    expect(getPayerProfile('nonexistent')).toBeUndefined();
  });
});

describe('listPayerProfiles', () => {
  it('returns an array of 5 profiles', () => {
    expect(listPayerProfiles()).toHaveLength(5);
  });

  it('all items are valid PayerProfile objects', () => {
    listPayerProfiles().forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.autoApproveRate).toBeLessThanOrEqual(1);
    });
  });
});

describe('listPayerIds', () => {
  it('returns all 5 payer IDs', () => {
    expect(listPayerIds()).toEqual(expect.arrayContaining(EXPECTED_IDS));
    expect(listPayerIds()).toHaveLength(5);
  });
});

describe('edge cases per payer', () => {
  it('medicare-advantage-humana has lower autoApproveRate (more strict)', () => {
    const ma = getPayerProfile('medicare-advantage-humana')!;
    const others = EXPECTED_IDS.filter((id) => id !== 'medicare-advantage-humana').map(
      (id) => PAYER_PROFILES[id].autoApproveRate,
    );
    const avgOthers = others.reduce((a, b) => a + b, 0) / others.length;
    expect(ma.autoApproveRate).toBeLessThan(avgOthers);
  });

  it('medicare-advantage-humana has highest averageResponseTime string "7d"', () => {
    expect(getPayerProfile('medicare-advantage-humana')?.averageResponseTime).toBe('7d');
  });

  it('cigna and medicare require peer-to-peer', () => {
    expect(getPayerProfile('cigna-commercial')?.requiresPeerToPeer).toBe(true);
    expect(getPayerProfile('medicare-advantage-humana')?.requiresPeerToPeer).toBe(true);
  });

  it('uhc and aetna do not require peer-to-peer', () => {
    expect(getPayerProfile('uhc-commercial')?.requiresPeerToPeer).toBe(false);
    expect(getPayerProfile('aetna-commercial')?.requiresPeerToPeer).toBe(false);
  });
});

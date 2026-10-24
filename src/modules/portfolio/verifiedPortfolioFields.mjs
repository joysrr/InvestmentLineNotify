import { parseNumber } from "../../utils/coreUtils.mjs";

const FIELD_NAMES = {
  accountNetAsset: "帳戶淨資產",
  collateralValue: "擔保品市值",
  accountNetAssetSource: "帳戶淨資產來源",
  accountNetAssetAsOf: "帳戶淨資產時間",
  collateralValueSource: "擔保品市值來源",
  collateralValueAsOf: "擔保品市值時間",
};

function read(row, field) {
  const value = row?.get?.(field);
  return typeof value === "string" ? value.trim() : value;
}

export function buildVerifiedPortfolioState(portfolio) {
  const fields = {
    accountNetAsset: portfolio?.accountNetAsset,
    accountNetAssetSource: portfolio?.accountNetAssetSource,
    accountNetAssetAsOf: portfolio?.accountNetAssetAsOf,
    collateralValue: portfolio?.collateralValue,
    collateralValueSource: portfolio?.collateralValueSource,
    collateralValueAsOf: portfolio?.collateralValueAsOf,
  };

  if (
    !Number.isFinite(fields.accountNetAsset) ||
    fields.accountNetAsset <= 0 ||
    !Number.isFinite(fields.collateralValue) ||
    fields.collateralValue <= 0 ||
    !fields.accountNetAssetSource ||
    !fields.accountNetAssetAsOf ||
    !fields.collateralValueSource ||
    !fields.collateralValueAsOf
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "ACCOUNT_FIELDS_NOT_VERIFIED",
      source: "INTERNAL_DERIVATION_ONLY",
      asOf: null,
    };
  }

  return {
    status: "VERIFIED",
    source: fields.accountNetAssetSource,
    asOf: fields.accountNetAssetAsOf,
    ...fields,
  };
}

export function mapVerifiedPortfolioFields(row) {
  const accountNetAsset = parseNumber(read(row, FIELD_NAMES.accountNetAsset));
  const collateralValue = parseNumber(read(row, FIELD_NAMES.collateralValue));
  const accountNetAssetSource = read(row, FIELD_NAMES.accountNetAssetSource);
  const accountNetAssetAsOf = read(row, FIELD_NAMES.accountNetAssetAsOf);
  const collateralValueSource = read(row, FIELD_NAMES.collateralValueSource);
  const collateralValueAsOf = read(row, FIELD_NAMES.collateralValueAsOf);

  if (
    !Number.isFinite(accountNetAsset) ||
    accountNetAsset <= 0 ||
    !Number.isFinite(collateralValue) ||
    collateralValue <= 0 ||
    !accountNetAssetSource ||
    !accountNetAssetAsOf ||
    !collateralValueSource ||
    !collateralValueAsOf
  ) {
    return {
      status: "UNAVAILABLE",
      reason: "MISSING_VERIFIED_ACCOUNT_FIELDS",
    };
  }

  return {
    status: "VERIFIED",
    accountNetAsset,
    accountNetAssetSource,
    accountNetAssetAsOf,
    collateralValue,
    collateralValueSource,
    collateralValueAsOf,
  };
}

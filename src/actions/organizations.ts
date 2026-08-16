'use server'

/**
 * @deprecated This module is dead code — organizations are now just a
 * descriptive text field on the users table (organization_name).
 * Kept as a stub to avoid build errors from residual references.
 */

export async function createOrganization() {
  return { organization: null, error: 'Organizations module is deprecated.' }
}

export async function getUserOrganizations() {
  return { organizations: [], error: null }
}

export async function switchActiveOrganization() {
  return { success: false, error: 'Organizations module is deprecated.' }
}

export async function getActiveOrganization() {
  return { organization: null, membershipRole: null, error: null }
}

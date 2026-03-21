import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized lookup queries for shared reference data.
 * Eliminates duplicate .from('findings').select('*').order('name') etc. across routes.
 */

export async function getFindings(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('findings').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function getUnitTypes(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('unit_types').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function getCrops(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('crops').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function getMaterials(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('materials').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function getCustomers(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('customers').select('*').order('name');
  if (error) throw error;
  return data || [];
}

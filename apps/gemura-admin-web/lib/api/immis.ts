import { apiClient } from './client';

export interface ImmisLocation {
  id: number;
  type: string;
  code: string;
  name: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
  parent?: ImmisLocation;
}

export interface ImmisOrganization {
  id: number;
  name: string;
  abbreviation: string;
  location_id: number | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImmisGroup {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface ImmisMember {
  id: number;
  document_number: string;
  rca_number: string;
  document_type: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  cluster: string;
  disability: string;
  representative_name: string;
  representative_title: string;
  certificate_issued_at: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
  location: ImmisLocation | null;
  group: ImmisGroup | null;
  organization: ImmisOrganization | null;
}

export interface ImmisMembersResponse {
  status: number;
  message: string;
  data:
    | {
        page: string;
        limit: string;
        totalPages: number;
        totalCount: number;
        totalOnPage: number;
        members: {
          count: number;
          rows: ImmisMember[];
        };
      }
    | null;
}

export interface ImmisMemberResponse {
  status: number;
  message: string;
  data: ImmisMember | null;
}

export const immisApi = {
  listMembers(params?: { page?: number; limit?: number }): Promise<ImmisMembersResponse> {
    return apiClient.get<ImmisMembersResponse>('/immis/members', {
      params: {
        page: params?.page,
        limit: params?.limit,
      },
    });
  },

  getMember(memberId: string): Promise<ImmisMemberResponse> {
    return apiClient.get<ImmisMemberResponse>(`/immis/members/${encodeURIComponent(memberId)}`);
  },

  getMemberLinks(memberIds: number[]): Promise<{
    status: number;
    message: string;
    data: Record<string, { user_id: string; name: string; phone: string | null }> | null;
  }> {
    if (!memberIds.length) {
      return Promise.resolve({ status: 200, message: 'OK', data: {} });
    }
    return apiClient.get('/immis/member-links', {
      params: { ids: memberIds.join(',') },
    });
  },
};


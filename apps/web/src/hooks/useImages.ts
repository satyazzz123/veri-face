import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '../services/api';
import { FilterStatus } from '../types';

export function useImages(filter: FilterStatus, search: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['images', filter, search],
    queryFn: () => ApiClient.getImages({ status: filter, search, limit: 50 }),
    refetchInterval: 10000, // Poll fallback every 10s if SSE reconnecting
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ApiClient.deleteImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  });

  return {
    images: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    deleteImage: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

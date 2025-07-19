'use client';

import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/layout';
import { Button, Input, Card, Badge, Modal } from '@/components/common';
import { usePeopleStore } from '@/stores/peopleStore';
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Mail,
  Phone,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function PeoplePage() {
  const {
    people,
    loading,
    error,
    totalCount,
    currentPage,
    pageSize,
    filters,
    fetchPeople,
    searchPeople,
    setFilter,
    clearFilters,
    setPage,
    deletePerson,
  } = usePeopleStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  useEffect(() => {
    fetchPeople();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchPeople(searchQuery);
    } else {
      fetchPeople();
    }
  };

  const handleDeletePerson = async (id: string) => {
    if (confirm('Are you sure you want to delete this person?')) {
      try {
        await deletePerson(id);
      } catch (error) {
        console.error('Failed to delete person:', error);
      }
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Layout activeSection="people">
      <div className="space-y-lg">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md">
          <div>
            <h1 className="text-3xl font-bold text-neutral-gray-900">People</h1>
            <p className="text-neutral-gray-600 mt-1">
              Manage your church members and visitors
            </p>
          </div>
          <div className="flex gap-sm">
            <Button variant="outline" size="md">
              <Upload className="w-4 h-4" />
              Import
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Add Person
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <Card padding="md">
          <div className="flex flex-col lg:flex-row gap-md">
            <form onSubmit={handleSearch} className="flex-1 flex gap-sm">
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="primary">
                <Search className="w-4 h-4" />
              </Button>
            </form>
            <div className="flex gap-sm">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
                Filters
                {Object.keys(filters).length > 0 && (
                  <Badge variant="info" size="sm">
                    {Object.keys(filters).length}
                  </Badge>
                )}
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-lg pt-lg border-t border-neutral-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
                <div>
                  <label className="text-sm font-medium text-neutral-gray-700 mb-1 block">
                    Membership Status
                  </label>
                  <select
                    className="w-full px-md py-sm border border-neutral-gray-300 rounded-lg"
                    value={filters.membershipStatus?.[0] || ''}
                    onChange={(e) =>
                      setFilter(
                        'membershipStatus',
                        e.target.value ? [e.target.value] : undefined
                      )
                    }
                  >
                    <option value="">All</option>
                    <option value="visitor">Visitor</option>
                    <option value="regular">Regular</option>
                    <option value="member">Member</option>
                  </select>
                </div>
                <div className="flex items-end gap-sm">
                  <label className="flex items-center gap-xs">
                    <input
                      type="checkbox"
                      checked={filters.hasEmail || false}
                      onChange={(e) => setFilter('hasEmail', e.target.checked || undefined)}
                    />
                    <span className="text-sm text-neutral-gray-700">Has Email</span>
                  </label>
                  <label className="flex items-center gap-xs">
                    <input
                      type="checkbox"
                      checked={filters.hasPhone || false}
                      onChange={(e) => setFilter('hasPhone', e.target.checked || undefined)}
                    />
                    <span className="text-sm text-neutral-gray-700">Has Phone</span>
                  </label>
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* People List */}
        {error && (
          <Card padding="md" className="bg-red-50 border-red-200">
            <p className="text-sm text-red-800">Error: {error}</p>
          </Card>
        )}

        {loading ? (
          <Card padding="lg">
            <div className="text-center">
              <p className="text-neutral-gray-600">Loading...</p>
            </div>
          </Card>
        ) : people.length === 0 ? (
          <Card padding="lg">
            <div className="text-center">
              <User className="w-12 h-12 text-neutral-gray-400 mx-auto mb-md" />
              <p className="text-neutral-gray-600">No people found</p>
              <p className="text-sm text-neutral-gray-500 mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-md">
              {people.map((person) => (
                <Card key={person.id} padding="md" interactive>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-md">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-neutral-gray-900">
                          {person.firstName} {person.lastName}
                        </h3>
                        <div className="flex items-center gap-md text-sm text-neutral-gray-600 mt-1">
                          {person.email && (
                            <div className="flex items-center gap-xs">
                              <Mail className="w-3 h-3" />
                              {person.email}
                            </div>
                          )}
                          {person.phone && (
                            <div className="flex items-center gap-xs">
                              <Phone className="w-3 h-3" />
                              {person.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-sm">
                      <Badge
                        variant={
                          person.membershipStatus === 'member'
                            ? 'success'
                            : person.membershipStatus === 'regular'
                            ? 'info'
                            : 'default'
                        }
                      >
                        {person.membershipStatus}
                      </Badge>
                      <div className="relative">
                        <button
                          className="p-1 rounded hover:bg-neutral-gray-100"
                          onClick={() =>
                            setSelectedPerson(
                              selectedPerson === person.id ? null : person.id
                            )
                          }
                        >
                          <MoreVertical className="w-4 h-4 text-neutral-gray-600" />
                        </button>
                        {selectedPerson === person.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setSelectedPerson(null)}
                            />
                            <div className="absolute right-0 mt-1 w-48 bg-neutral-white rounded-lg shadow-lg border border-neutral-gray-200 py-1 z-20">
                              <button
                                className="w-full px-4 py-2 text-sm text-left text-neutral-gray-700 hover:bg-neutral-gray-50"
                                onClick={() => {
                                  // TODO: Navigate to person detail
                                  setSelectedPerson(null);
                                }}
                              >
                                View Profile
                              </button>
                              <button
                                className="w-full px-4 py-2 text-sm text-left text-neutral-gray-700 hover:bg-neutral-gray-50"
                                onClick={() => {
                                  // TODO: Open edit modal
                                  setSelectedPerson(null);
                                }}
                              >
                                Edit
                              </button>
                              <hr className="my-1 border-neutral-gray-200" />
                              <button
                                className="w-full px-4 py-2 text-sm text-left text-semantic-error hover:bg-neutral-gray-50"
                                onClick={() => {
                                  handleDeletePerson(person.id);
                                  setSelectedPerson(null);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-gray-600">
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, totalCount)} of {totalCount} people
              </p>
              <div className="flex items-center gap-sm">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-xs">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        className={`w-8 h-8 rounded-md text-sm font-medium ${
                          page === currentPage
                            ? 'bg-primary-600 text-neutral-white'
                            : 'text-neutral-gray-600 hover:bg-neutral-gray-100'
                        }`}
                        onClick={() => setPage(page)}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Add Person Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Person"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button variant="primary">Save Person</Button>
            </>
          }
        >
          <p className="text-neutral-gray-600">
            Add person form will be implemented here...
          </p>
        </Modal>
      </div>
    </Layout>
  );
}
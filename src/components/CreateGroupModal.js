import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { getAllAvailableMembers } from '../services/chatService';

export default function CreateGroupModal({
  visible,
  onClose,
  currentUser,
  existingGroup = null,
  onGroupSaved,
}) {
  const { colors, isDark } = useAppTheme();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(existingGroup);

  useEffect(() => {
    let isMounted = true;
    if (visible) {
      getAllAvailableMembers().then((allMembers) => {
        if (isMounted) {
          setMembers(allMembers);
          if (existingGroup) {
            setGroupName(existingGroup.name || '');
            setDescription(existingGroup.description || '');
            setSelectedMemberIds(new Set(existingGroup.memberIds || []));
          } else {
            setGroupName('');
            setDescription('');
            const myId = String(currentUser?.id || currentUser?.readerId || currentUser?.username || 'admin');
            setSelectedMemberIds(new Set([myId]));
          }
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [visible, existingGroup, currentUser]);

  const toggleMember = (memberId) => {
    const next = new Set(selectedMemberIds);
    if (next.has(memberId)) {
      next.delete(memberId);
    } else {
      next.add(memberId);
    }
    setSelectedMemberIds(next);
  };

  const handleSelectAll = () => {
    if (selectedMemberIds.size === members.length) {
      // إذا كان الكل مختاراً، نبقي على المستخدم الحالي فقط
      const myId = String(currentUser?.id || currentUser?.readerId || currentUser?.username || 'admin');
      setSelectedMemberIds(new Set([myId]));
    } else {
      const allIds = members.map((m) => m.id);
      setSelectedMemberIds(new Set(allIds));
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة اسم المجموعة');
      return;
    }

    if (selectedMemberIds.size === 0) {
      Alert.alert('تنبيه', 'يجب اختيار عضو واحد على الأقل في المجموعة');
      return;
    }

    // التأكد من تضمين المدير الحالي دائماً
    const myId = String(currentUser?.id || currentUser?.readerId || currentUser?.username || 'admin');
    const finalMemberIds = Array.from(new Set([...selectedMemberIds, myId]));

    setLoading(true);
    try {
      const groupData = {
        id: existingGroup ? existingGroup.id : `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: groupName.trim(),
        description: description.trim(),
        memberIds: finalMemberIds,
        createdBy: myId,
        createdByName: currentUser?.name || 'المدير',
        createdAt: existingGroup ? existingGroup.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (onGroupSaved) {
        await onGroupSaved(groupData);
      }
      onClose();
    } catch (_e) {
      Alert.alert('خطأ', 'تعذر حفظ بيانات المجموعة');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.username?.toLowerCase().includes(q)
    );
  });

  const allSelected = members.length > 0 && selectedMemberIds.size === members.length;
  const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 28) : 10;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bgPage }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

        {/* Header with status bar padding */}
        <View style={[styles.header, { backgroundColor: colors.bgPrimary, paddingTop: statusBarOffset }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.textHeader }]}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.textHeader }]}>
              {isEditing ? 'تعديل بيانات المجموعة' : 'إنشاء مجموعة محادثة جديدة'}
            </Text>
            <Text style={[styles.headerSub, { color: 'rgba(255, 255, 255, 0.75)' }]}>
              مجموعة مشفرة بين الأعضاء المحددين
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            {/* Group Name & Desc Inputs */}
            <View style={[styles.inputCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>اسم المجموعة *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.bgSubtle,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="مثال: حلقة الفجر، شباب الحفظ، إدارة المسابقة..."
                placeholderTextColor={colors.textMuted}
                value={groupName}
                onChangeText={setGroupName}
                textAlign="right"
              />

              <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 10 }]}>
                وصف المجموعة (اختياري)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.bgSubtle,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="اكتب نبذة عن أهداف هذه المجموعة..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                textAlign="right"
              />
            </View>

            {/* Members Section Header */}
            <View style={styles.membersSectionHeader}>
              <TouchableOpacity
                onPress={handleSelectAll}
                style={[
                  styles.selectAllBtn,
                  {
                    backgroundColor: allSelected ? colors.accentLight : colors.bgSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.selectAllText, { color: colors.accent }]}>
                  {allSelected ? '✓ إلغاء تحديد الكل' : '☑️ تحديد الكل'}
                </Text>
              </TouchableOpacity>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  أعضاء المجموعة ({selectedMemberIds.size} من {members.length})
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  اختر من ينضم لهذه المحادثة (المدراء والقراء)
                </Text>
              </View>
            </View>

            {/* Member Search Bar */}
            <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="ابحث بالاسم أو اسم المستخدم..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                textAlign="right"
              />
              <Text style={styles.searchIcon}>🔍</Text>
            </View>

            {/* Members List */}
            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.membersList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selectedMemberIds.has(item.id);
                const isAdmin = item.role === 'admin';

                return (
                  <TouchableOpacity
                    style={[
                      styles.memberItem,
                      {
                        backgroundColor: isSelected ? (isDark ? '#064E3B40' : '#ECFDF5') : colors.bgCard,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => toggleMember(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Checkbox */}
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? colors.accent : colors.border,
                          backgroundColor: isSelected ? colors.accent : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <Text style={styles.checkmarkText}>✓</Text>}
                    </View>

                    {/* Member Details */}
                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.memberName, { color: colors.textPrimary }]}>
                          {item.name}
                        </Text>
                        {isAdmin && (
                          <View style={[styles.adminTag, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                            <Text style={[styles.adminTagText, { color: colors.gold }]}>👑 مشرف</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.memberUser, { color: colors.textSecondary }]}>
                        @{item.username || item.id}
                      </Text>
                    </View>

                    {/* Avatar */}
                    <View style={[styles.avatarCircle, { backgroundColor: isAdmin ? colors.goldBg : colors.accentLight }]}>
                      <Text style={{ fontSize: 16 }}>{isAdmin ? '👑' : '📖'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Save Button */}
            <View style={[styles.footer, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>
                  {loading ? 'جاري الحفظ وتوزيع المفاتيح...' : isEditing ? 'حفظ التعديلات ✓' : 'إنشاء المجموعة المشفرة 🔒'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitleWrap: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  inputCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'right',
  },
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectAllText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginLeft: 6,
  },
  membersList: {
    gap: 8,
    paddingBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberInfo: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  memberName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  memberUser: {
    fontSize: 10.5,
    marginTop: 2,
  },
  adminTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  adminTagText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
